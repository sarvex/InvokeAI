# Copyright (c) 2023 Kyle Schouviller (https://github.com/kyle0654)

import random
from typing import Literal, Optional, Union
import einops
from pydantic import BaseModel, Field, validator
import torch

from invokeai.app.invocations.util.choose_model import choose_model
from invokeai.app.models.image import ImageCategory
from invokeai.app.util.misc import SEED_MAX, get_random_seed

from invokeai.app.util.step_callback import stable_diffusion_step_callback

from ...backend.model_management.model_manager import ModelManager
from ...backend.util.devices import choose_torch_device, torch_dtype
from ...backend.stable_diffusion.diffusion.shared_invokeai_diffusion import PostprocessingSettings
from ...backend.image_util.seamless import configure_model_padding
from ...backend.prompting.conditioning import get_uc_and_c_and_ec
from ...backend.stable_diffusion.diffusers_pipeline import ConditioningData, StableDiffusionGeneratorPipeline, image_resized_to_grid_as_tensor
from ...backend.stable_diffusion.schedulers import SCHEDULER_MAP
from .baseinvocation import BaseInvocation, BaseInvocationOutput, InvocationContext, InvocationConfig
import numpy as np
from ..services.image_file_storage import ImageType
from .baseinvocation import BaseInvocation, InvocationContext
from .image import ImageField, ImageOutput
from .compel import ConditioningField
from ...backend.stable_diffusion import PipelineIntermediateState
from diffusers.schedulers import SchedulerMixin as Scheduler
import diffusers
from diffusers import DiffusionPipeline


class LatentsField(BaseModel):
    """A latents field used for passing latents between invocations"""

    latents_name: Optional[str] = Field(default=None, description="The name of the latents")

    class Config:
        schema_extra = {"required": ["latents_name"]}

class LatentsOutput(BaseInvocationOutput):
    """Base class for invocations that output latents"""
    #fmt: off
    type: Literal["latents_output"] = "latents_output"

    # Inputs
    latents: LatentsField          = Field(default=None, description="The output latents")
    width:                     int = Field(description="The width of the latents in pixels")
    height:                    int = Field(description="The height of the latents in pixels")
    #fmt: on


def build_latents_output(latents_name: str, latents: torch.Tensor):
      return LatentsOutput(
          latents=LatentsField(latents_name=latents_name),
          width=latents.size()[3] * 8,
          height=latents.size()[2] * 8,
      )

class NoiseOutput(BaseInvocationOutput):
    """Invocation noise output"""
    #fmt: off
    type:  Literal["noise_output"] = "noise_output"

    # Inputs
    noise: LatentsField            = Field(default=None, description="The output noise")
    width:                     int = Field(description="The width of the noise in pixels")
    height:                    int = Field(description="The height of the noise in pixels")
    #fmt: on

def build_noise_output(latents_name: str, latents: torch.Tensor):
      return NoiseOutput(
          noise=LatentsField(latents_name=latents_name),
          width=latents.size()[3] * 8,
          height=latents.size()[2] * 8,
      )


SAMPLER_NAME_VALUES = Literal[
    tuple(list(SCHEDULER_MAP.keys()))
]


def get_scheduler(scheduler_name:str, model: StableDiffusionGeneratorPipeline)->Scheduler:
    scheduler_class, scheduler_extra_config = SCHEDULER_MAP.get(scheduler_name, SCHEDULER_MAP['ddim'])
    
    scheduler_config = model.scheduler.config
    if "_backup" in scheduler_config:
        scheduler_config = scheduler_config["_backup"]
    scheduler_config = {**scheduler_config, **scheduler_extra_config, "_backup": scheduler_config}
    scheduler = scheduler_class.from_config(scheduler_config)
    
    # hack copied over from generate.py
    if not hasattr(scheduler, 'uses_inpainting_model'):
        scheduler.uses_inpainting_model = lambda: False
    return scheduler


def get_noise(width:int, height:int, device:torch.device, seed:int = 0, latent_channels:int=4, use_mps_noise:bool=False, downsampling_factor:int = 8):
    # limit noise to only the diffusion image channels, not the mask channels
    input_channels = min(latent_channels, 4)
    use_device = "cpu" if (use_mps_noise or device.type == "mps") else device
    generator = torch.Generator(device=use_device).manual_seed(seed)
    x = torch.randn(
        [
            1,
            input_channels,
            height // downsampling_factor,
            width //  downsampling_factor,
        ],
        dtype=torch_dtype(device),
        device=use_device,
        generator=generator,
    ).to(device)
    # if self.perlin > 0.0:
    #     perlin_noise = self.get_perlin_noise(
    #         width // self.downsampling_factor, height // self.downsampling_factor
    #     )
    #     x = (1 - self.perlin) * x + self.perlin * perlin_noise
    return x


class NoiseInvocation(BaseInvocation):
    """Generates latent noise."""

    type: Literal["noise"] = "noise"

    # Inputs
    seed:       int = Field(ge=0, le=SEED_MAX, description="The seed to use", default_factory=get_random_seed)
    width:       int = Field(default=512, multiple_of=8, gt=0, description="The width of the resulting noise", )
    height:      int = Field(default=512, multiple_of=8, gt=0, description="The height of the resulting noise", )


    # Schema customisation
    class Config(InvocationConfig):
        schema_extra = {
            "ui": {
                "tags": ["latents", "noise"],
            },
        }

    @validator("seed", pre=True)
    def modulo_seed(cls, v):
        """Returns the seed modulo SEED_MAX to ensure it is within the valid range."""
        return v % SEED_MAX

    def invoke(self, context: InvocationContext) -> NoiseOutput:
        device = torch.device(choose_torch_device())
        noise = get_noise(self.width, self.height, device, self.seed)

        name = f'{context.graph_execution_state_id}__{self.id}'
        context.services.latents.save(name, noise)
        return build_noise_output(latents_name=name, latents=noise)


# Text to image
class TextToLatentsInvocation(BaseInvocation):
    """Generates latents from conditionings."""

    type: Literal["t2l"] = "t2l"

    # Inputs
    # fmt: off
    positive_conditioning: Optional[ConditioningField] = Field(description="Positive conditioning for generation")
    negative_conditioning: Optional[ConditioningField] = Field(description="Negative conditioning for generation")
    noise: Optional[LatentsField] = Field(description="The noise to use")
    steps:       int = Field(default=10, gt=0, description="The number of steps to use to generate the image")
    cfg_scale: float = Field(default=7.5, gt=0, description="The Classifier-Free Guidance, higher values may result in a result closer to the prompt", )
    scheduler: SAMPLER_NAME_VALUES = Field(default="lms", description="The scheduler to use" )
    model:       str = Field(default="", description="The model to use (currently ignored)")
    # seamless:   bool = Field(default=False, description="Whether or not to generate an image that can tile without seams", )
    # seamless_axes: str = Field(default="", description="The axes to tile the image on, 'x' and/or 'y'")
    # fmt: on

    # Schema customisation
    class Config(InvocationConfig):
        schema_extra = {
            "ui": {
                "tags": ["latents", "image"],
                "type_hints": {
                  "model": "model"
                }
            },
        }

    # TODO: pass this an emitter method or something? or a session for dispatching?
    def dispatch_progress(
        self, context: InvocationContext, source_node_id: str, intermediate_state: PipelineIntermediateState
    ) -> None:
        stable_diffusion_step_callback(
            context=context,
            intermediate_state=intermediate_state,
            node=self.dict(),
            source_node_id=source_node_id,
        )

    def get_model(self, model_manager: ModelManager) -> StableDiffusionGeneratorPipeline:
        model_info = choose_model(model_manager, self.model)
        model_name = model_info['model_name']
        model_hash = model_info['hash']
        model: StableDiffusionGeneratorPipeline = model_info['model']
        model.scheduler = get_scheduler(
            model=model,
            scheduler_name=self.scheduler
        )

        # if isinstance(model, DiffusionPipeline):
        #     for component in [model.unet, model.vae]:
        #         configure_model_padding(component,
        #                                 self.seamless,
        #                                 self.seamless_axes
        #                                 )
        # else:
        #     configure_model_padding(model,
        #                             self.seamless,
        #                             self.seamless_axes
        #                             )

        return model


    def get_conditioning_data(self, context: InvocationContext, model: StableDiffusionGeneratorPipeline) -> ConditioningData:
        c, extra_conditioning_info = context.services.latents.get(self.positive_conditioning.conditioning_name)
        uc, _ = context.services.latents.get(self.negative_conditioning.conditioning_name)

        conditioning_data = ConditioningData(
            uc,
            c,
            self.cfg_scale,
            extra_conditioning_info,
            postprocessing_settings=PostprocessingSettings(
                threshold=0.0,#threshold,
                warmup=0.2,#warmup,
                h_symmetry_time_pct=None,#h_symmetry_time_pct,
                v_symmetry_time_pct=None#v_symmetry_time_pct,
            ),
        ).add_scheduler_args_if_applicable(model.scheduler, eta=0.0)#ddim_eta)
        return conditioning_data


    def invoke(self, context: InvocationContext) -> LatentsOutput:
        noise = context.services.latents.get(self.noise.latents_name)

        # Get the source node id (we are invoking the prepared node)
        graph_execution_state = context.services.graph_execution_manager.get(context.graph_execution_state_id)
        source_node_id = graph_execution_state.prepared_source_mapping[self.id]

        def step_callback(state: PipelineIntermediateState):
            self.dispatch_progress(context, source_node_id, state)

        model = self.get_model(context.services.model_manager)
        conditioning_data = self.get_conditioning_data(context, model)

        # TODO: Verify the noise is the right size

        result_latents, result_attention_map_saver = model.latents_from_embeddings(
            latents=torch.zeros_like(noise, dtype=torch_dtype(model.device)),
            noise=noise,
            num_inference_steps=self.steps,
            conditioning_data=conditioning_data,
            callback=step_callback
        )

        # https://discuss.huggingface.co/t/memory-usage-by-later-pipeline-stages/23699
        torch.cuda.empty_cache()

        name = f'{context.graph_execution_state_id}__{self.id}'
        context.services.latents.save(name, result_latents)
        return build_latents_output(latents_name=name, latents=result_latents)


class LatentsToLatentsInvocation(TextToLatentsInvocation):
    """Generates latents using latents as base image."""

    type: Literal["l2l"] = "l2l"

    # Inputs
    latents: Optional[LatentsField] = Field(description="The latents to use as a base image")
    strength: float = Field(default=0.5, description="The strength of the latents to use")

    # Schema customisation
    class Config(InvocationConfig):
        schema_extra = {
            "ui": {
                "tags": ["latents"],
                "type_hints": {
                    "model": "model"
                }
            },
        }

    def invoke(self, context: InvocationContext) -> LatentsOutput:
        noise = context.services.latents.get(self.noise.latents_name)
        latent = context.services.latents.get(self.latents.latents_name)

        # Get the source node id (we are invoking the prepared node)
        graph_execution_state = context.services.graph_execution_manager.get(context.graph_execution_state_id)
        source_node_id = graph_execution_state.prepared_source_mapping[self.id]

        def step_callback(state: PipelineIntermediateState):
            self.dispatch_progress(context, source_node_id, state)

        model = self.get_model(context.services.model_manager)
        conditioning_data = self.get_conditioning_data(context, model)

        # TODO: Verify the noise is the right size

        initial_latents = latent if self.strength < 1.0 else torch.zeros_like(
            latent, device=model.device, dtype=latent.dtype
        )

        timesteps, _ = model.get_img2img_timesteps(self.steps, self.strength)

        result_latents, result_attention_map_saver = model.latents_from_embeddings(
            latents=initial_latents,
            timesteps=timesteps,
            noise=noise,
            num_inference_steps=self.steps,
            conditioning_data=conditioning_data,
            callback=step_callback
        )

        # https://discuss.huggingface.co/t/memory-usage-by-later-pipeline-stages/23699
        torch.cuda.empty_cache()

        name = f'{context.graph_execution_state_id}__{self.id}'
        context.services.latents.save(name, result_latents)
        return build_latents_output(latents_name=name, latents=result_latents)


# Latent to image
class LatentsToImageInvocation(BaseInvocation):
    """Generates an image from latents."""

    type: Literal["l2i"] = "l2i"

    # Inputs
    latents: Optional[LatentsField] = Field(description="The latents to generate an image from")
    model: str = Field(default="", description="The model to use")

    # Schema customisation
    class Config(InvocationConfig):
        schema_extra = {
            "ui": {
                "tags": ["latents", "image"],
                "type_hints": {
                  "model": "model"
                }
            },
        }

    @torch.no_grad()
    def invoke(self, context: InvocationContext) -> ImageOutput:
        latents = context.services.latents.get(self.latents.latents_name)

        # TODO: this only really needs the vae
        model_info = choose_model(context.services.model_manager, self.model)
        model: StableDiffusionGeneratorPipeline = model_info['model']

        with torch.inference_mode():
            np_image = model.decode_latents(latents)
            image = model.numpy_to_pil(np_image)[0]

            torch.cuda.empty_cache()

            image_dto = context.services.images.create(
                image=image,
                image_type=ImageType.RESULT,
                image_category=ImageCategory.GENERAL,
                session_id=context.graph_execution_state_id,
                node_id=self.id,
            )

            return ImageOutput(
                image=ImageField(
                    image_name=image_dto.image_name,
                    image_type=image_dto.image_type,
                ),
                width=image_dto.width,
                height=image_dto.height,
            )


LATENTS_INTERPOLATION_MODE = Literal[
    "nearest", "linear", "bilinear", "bicubic", "trilinear", "area", "nearest-exact"
]


class ResizeLatentsInvocation(BaseInvocation):
    """Resizes latents to explicit width/height (in pixels). Provided dimensions are floor-divided by 8."""

    type: Literal["lresize"] = "lresize"

    # Inputs
    latents:    Optional[LatentsField] = Field(description="The latents to resize")
    width:                         int = Field(ge=64, multiple_of=8, description="The width to resize to (px)")
    height:                        int = Field(ge=64, multiple_of=8, description="The height to resize to (px)")
    mode:   LATENTS_INTERPOLATION_MODE = Field(default="bilinear", description="The interpolation mode")
    antialias:                    bool = Field(default=False, description="Whether or not to antialias (applied in bilinear and bicubic modes only)")

    def invoke(self, context: InvocationContext) -> LatentsOutput:
        latents = context.services.latents.get(self.latents.latents_name)

        resized_latents = torch.nn.functional.interpolate(
            latents,
            size=(self.height // 8, self.width // 8),
            mode=self.mode,
            antialias=self.antialias if self.mode in ["bilinear", "bicubic"] else False,
        )

        # https://discuss.huggingface.co/t/memory-usage-by-later-pipeline-stages/23699
        torch.cuda.empty_cache()

        name = f"{context.graph_execution_state_id}__{self.id}"
        context.services.latents.save(name, resized_latents)
        return build_latents_output(latents_name=name, latents=resized_latents)


class ScaleLatentsInvocation(BaseInvocation):
    """Scales latents by a given factor."""

    type: Literal["lscale"] = "lscale"

    # Inputs
    latents:   Optional[LatentsField] = Field(description="The latents to scale")
    scale_factor:               float = Field(gt=0, description="The factor by which to scale the latents")
    mode:  LATENTS_INTERPOLATION_MODE = Field(default="bilinear", description="The interpolation mode")
    antialias:                   bool = Field(default=False, description="Whether or not to antialias (applied in bilinear and bicubic modes only)")

    def invoke(self, context: InvocationContext) -> LatentsOutput:
        latents = context.services.latents.get(self.latents.latents_name)

        # resizing
        resized_latents = torch.nn.functional.interpolate(
            latents,
            scale_factor=self.scale_factor,
            mode=self.mode,
            antialias=self.antialias if self.mode in ["bilinear", "bicubic"] else False,
        )

        # https://discuss.huggingface.co/t/memory-usage-by-later-pipeline-stages/23699
        torch.cuda.empty_cache()

        name = f"{context.graph_execution_state_id}__{self.id}"
        context.services.latents.save(name, resized_latents)
        return build_latents_output(latents_name=name, latents=resized_latents)


class ImageToLatentsInvocation(BaseInvocation):
    """Encodes an image into latents."""

    type: Literal["i2l"] = "i2l"

    # Inputs
    image: Union[ImageField, None] = Field(description="The image to encode")
    model: str = Field(default="", description="The model to use")

    # Schema customisation
    class Config(InvocationConfig):
        schema_extra = {
            "ui": {
                "tags": ["latents", "image"],
                "type_hints": {"model": "model"},
            },
        }

    @torch.no_grad()
    def invoke(self, context: InvocationContext) -> LatentsOutput:
        image = context.services.images.get_pil_image(
            self.image.image_type, self.image.image_name
        )

        # TODO: this only really needs the vae
        model_info = choose_model(context.services.model_manager, self.model)
        model: StableDiffusionGeneratorPipeline = model_info["model"]

        image_tensor = image_resized_to_grid_as_tensor(image.convert("RGB"))

        if image_tensor.dim() == 3:
            image_tensor = einops.rearrange(image_tensor, "c h w -> 1 c h w")

        latents = model.non_noised_latents_from_image(
            image_tensor,
            device=model._model_group.device_for(model.unet),
            dtype=model.unet.dtype,
        )

        name = f"{context.graph_execution_state_id}__{self.id}"
        context.services.latents.save(name, latents)
        return build_latents_output(latents_name=name, latents=latents)
        
