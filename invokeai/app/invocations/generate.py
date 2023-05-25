# Copyright (c) 2022 Kyle Schouviller (https://github.com/kyle0654)

from functools import partial
from typing import Literal, Optional, Union, get_args

import numpy as np
from torch import Tensor

from pydantic import BaseModel, Field

from invokeai.app.models.image import ColorField, ImageField, ImageType
from invokeai.app.invocations.util.choose_model import choose_model
from invokeai.app.models.image import ImageCategory, ImageType
from invokeai.app.util.misc import SEED_MAX, get_random_seed
from invokeai.backend.generator.inpaint import infill_methods
from .baseinvocation import BaseInvocation, InvocationContext, InvocationConfig
from .image import ImageOutput
from ...backend.generator import Txt2Img, Img2Img, Inpaint, InvokeAIGenerator
from ...backend.stable_diffusion import PipelineIntermediateState
from ..util.step_callback import stable_diffusion_step_callback

SAMPLER_NAME_VALUES = Literal[tuple(InvokeAIGenerator.schedulers())]
INFILL_METHODS = Literal[tuple(infill_methods())]
DEFAULT_INFILL_METHOD = (
    "patchmatch" if "patchmatch" in get_args(INFILL_METHODS) else "tile"
)


class SDImageInvocation(BaseModel):
    """Helper class to provide all Stable Diffusion raster image invocations with additional config"""

    # Schema customisation
    class Config(InvocationConfig):
        schema_extra = {
            "ui": {
                "tags": ["stable-diffusion", "image"],
                "type_hints": {
                    "model": "model",
                },
            },
        }


# Text to image
class TextToImageInvocation(BaseInvocation, SDImageInvocation):
    """Generates an image using text2img."""

    type: Literal["txt2img"] = "txt2img"

    # Inputs
    # TODO: consider making prompt optional to enable providing prompt through a link
    # fmt: off
    prompt: Optional[str] = Field(description="The prompt to generate an image from")
    seed:        int = Field(ge=0, le=SEED_MAX, description="The seed to use (omit for random)", default_factory=get_random_seed)
    steps:       int = Field(default=30, gt=0, description="The number of steps to use to generate the image")
    width:       int = Field(default=512, multiple_of=8, gt=0, description="The width of the resulting image", )
    height:      int = Field(default=512, multiple_of=8, gt=0, description="The height of the resulting image", )
    cfg_scale: float = Field(default=7.5, ge=1, description="The Classifier-Free Guidance, higher values may result in a result closer to the prompt", )
    scheduler: SAMPLER_NAME_VALUES = Field(default="lms", description="The scheduler to use" )
    model:       str = Field(default="", description="The model to use (currently ignored)")
    # fmt: on

    # TODO: pass this an emitter method or something? or a session for dispatching?
    def dispatch_progress(
        self,
        context: InvocationContext,
        source_node_id: str,
        intermediate_state: PipelineIntermediateState,
    ) -> None:
        stable_diffusion_step_callback(
            context=context,
            intermediate_state=intermediate_state,
            node=self.dict(),
            source_node_id=source_node_id,
        )

    def invoke(self, context: InvocationContext) -> ImageOutput:
        # Handle invalid model parameter
        model = choose_model(context.services.model_manager, self.model)

        # Get the source node id (we are invoking the prepared node)
        graph_execution_state = context.services.graph_execution_manager.get(
            context.graph_execution_state_id
        )
        source_node_id = graph_execution_state.prepared_source_mapping[self.id]

        outputs = Txt2Img(model).generate(
            prompt=self.prompt,
            step_callback=partial(self.dispatch_progress, context, source_node_id),
            **self.dict(
                exclude={"prompt"}
            ),  # Shorthand for passing all of the parameters above manually
        )
        # Outputs is an infinite iterator that will return a new InvokeAIGeneratorOutput object
        # each time it is called. We only need the first one.
        generate_output = next(outputs)

        image_dto = context.services.images.create(
            image=generate_output.image,
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


class ImageToImageInvocation(TextToImageInvocation):
    """Generates an image using img2img."""

    type: Literal["img2img"] = "img2img"

    # Inputs
    image: Union[ImageField, None] = Field(description="The input image")
    strength: float = Field(
        default=0.75, gt=0, le=1, description="The strength of the original image"
    )
    fit: bool = Field(
        default=True,
        description="Whether or not the result should be fit to the aspect ratio of the input image",
    )

    def dispatch_progress(
        self,
        context: InvocationContext,
        source_node_id: str,
        intermediate_state: PipelineIntermediateState,
    ) -> None:
        stable_diffusion_step_callback(
            context=context,
            intermediate_state=intermediate_state,
            node=self.dict(),
            source_node_id=source_node_id,
        )

    def invoke(self, context: InvocationContext) -> ImageOutput:
        image = (
            None
            if self.image is None
            else context.services.images.get_pil_image(
                self.image.image_type, self.image.image_name
            )
        )

        if self.fit:
            image = image.resize((self.width, self.height))

        # Handle invalid model parameter
        model = choose_model(context.services.model_manager, self.model)

        # Get the source node id (we are invoking the prepared node)
        graph_execution_state = context.services.graph_execution_manager.get(
            context.graph_execution_state_id
        )
        source_node_id = graph_execution_state.prepared_source_mapping[self.id]

        outputs = Img2Img(model).generate(
            prompt=self.prompt,
            init_image=image,
            step_callback=partial(self.dispatch_progress, context, source_node_id),
            **self.dict(
                exclude={"prompt", "image", "mask"}
            ),  # Shorthand for passing all of the parameters above manually
        )

        # Outputs is an infinite iterator that will return a new InvokeAIGeneratorOutput object
        # each time it is called. We only need the first one.
        generator_output = next(outputs)

        image_dto = context.services.images.create(
            image=generator_output.image,
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


class InpaintInvocation(ImageToImageInvocation):
    """Generates an image using inpaint."""

    type: Literal["inpaint"] = "inpaint"

    # Inputs
    mask: Union[ImageField, None] = Field(description="The mask")
    seam_size: int = Field(default=96, ge=1, description="The seam inpaint size (px)")
    seam_blur: int = Field(
        default=16, ge=0, description="The seam inpaint blur radius (px)"
    )
    seam_strength: float = Field(
        default=0.75, gt=0, le=1, description="The seam inpaint strength"
    )
    seam_steps: int = Field(
        default=30, ge=1, description="The number of steps to use for seam inpaint"
    )
    tile_size: int = Field(
        default=32, ge=1, description="The tile infill method size (px)"
    )
    infill_method: INFILL_METHODS = Field(
        default=DEFAULT_INFILL_METHOD,
        description="The method used to infill empty regions (px)",
    )
    inpaint_width: Optional[int] = Field(
        default=None,
        multiple_of=8,
        gt=0,
        description="The width of the inpaint region (px)",
    )
    inpaint_height: Optional[int] = Field(
        default=None,
        multiple_of=8,
        gt=0,
        description="The height of the inpaint region (px)",
    )
    inpaint_fill: Optional[ColorField] = Field(
        default=ColorField(r=127, g=127, b=127, a=255),
        description="The solid infill method color",
    )
    inpaint_replace: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="The amount by which to replace masked areas with latent noise",
    )

    def dispatch_progress(
        self,
        context: InvocationContext,
        source_node_id: str,
        intermediate_state: PipelineIntermediateState,
    ) -> None:
        stable_diffusion_step_callback(
            context=context,
            intermediate_state=intermediate_state,
            node=self.dict(),
            source_node_id=source_node_id,
        )

    def invoke(self, context: InvocationContext) -> ImageOutput:
        image = (
            None
            if self.image is None
            else context.services.images.get_pil_image(
                self.image.image_type, self.image.image_name
            )
        )
        mask = (
            None
            if self.mask is None
            else context.services.images.get_pil_image(self.mask.image_type, self.mask.image_name)
        )

        # Handle invalid model parameter
        model = choose_model(context.services.model_manager, self.model)

        # Get the source node id (we are invoking the prepared node)
        graph_execution_state = context.services.graph_execution_manager.get(
            context.graph_execution_state_id
        )
        source_node_id = graph_execution_state.prepared_source_mapping[self.id]

        outputs = Inpaint(model).generate(
            prompt=self.prompt,
            init_image=image,
            mask_image=mask,
            step_callback=partial(self.dispatch_progress, context, source_node_id),
            **self.dict(
                exclude={"prompt", "image", "mask"}
            ),  # Shorthand for passing all of the parameters above manually
        )

        # Outputs is an infinite iterator that will return a new InvokeAIGeneratorOutput object
        # each time it is called. We only need the first one.
        generator_output = next(outputs)

        image_dto = context.services.images.create(
            image=generator_output.image,
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
