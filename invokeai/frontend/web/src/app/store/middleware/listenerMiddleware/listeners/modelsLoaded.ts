import { log } from 'app/logging/useLogger';
import { loraRemoved } from 'features/lora/store/loraSlice';
import {
  modelChanged,
  vaeSelected,
} from 'features/parameters/store/generationSlice';
import {
  zMainModel,
  zVaeModel,
} from 'features/parameters/types/parameterSchemas';
import { forEach, some } from 'lodash-es';
import { modelsApi } from 'services/api/endpoints/models';
import { startAppListening } from '..';

const moduleLog = log.child({ module: 'models' });

export const addModelsLoadedListener = () => {
  startAppListening({
    matcher: modelsApi.endpoints.getMainModels.matchFulfilled,
    effect: async (action, { getState, dispatch }) => {
      // models loaded, we need to ensure the selected model is available and if not, select the first one

      const currentModel = getState().generation.model;

      const isCurrentModelAvailable = some(
        action.payload.entities,
        (m) =>
          m?.model_name === currentModel?.model_name &&
          m?.base_model === currentModel?.base_model
      );

      if (isCurrentModelAvailable) {
        return;
      }

      const firstModelId = action.payload.ids[0];
      const firstModel = action.payload.entities[firstModelId];

      if (!firstModel) {
        // No models loaded at all
        dispatch(modelChanged(null));
        return;
      }

      const result = zMainModel.safeParse(firstModel);

      if (!result.success) {
        moduleLog.error(
          { error: result.error.format() },
          'Failed to parse main model'
        );
        return;
      }

      dispatch(modelChanged(result.data));
    },
  });
  startAppListening({
    matcher: modelsApi.endpoints.getVaeModels.matchFulfilled,
    effect: async (action, { getState, dispatch }) => {
      // VAEs loaded, need to reset the VAE is it's no longer available

      const currentVae = getState().generation.vae;

      if (currentVae === null) {
        // null is a valid VAE! it means "use the default with the main model"
        return;
      }

      const isCurrentVAEAvailable = some(
        action.payload.entities,
        (m) =>
          m?.model_name === currentVae?.model_name &&
          m?.base_model === currentVae?.base_model
      );

      if (isCurrentVAEAvailable) {
        return;
      }

      const firstModelId = action.payload.ids[0];
      const firstModel = action.payload.entities[firstModelId];

      if (!firstModel) {
        // No custom VAEs loaded at all; use the default
        dispatch(modelChanged(null));
        return;
      }

      const result = zVaeModel.safeParse(firstModel);

      if (!result.success) {
        moduleLog.error(
          { error: result.error.format() },
          'Failed to parse VAE model'
        );
        return;
      }

      dispatch(vaeSelected(result.data));
    },
  });
  startAppListening({
    matcher: modelsApi.endpoints.getLoRAModels.matchFulfilled,
    effect: async (action, { getState, dispatch }) => {
      // LoRA models loaded - need to remove missing LoRAs from state

      const loras = getState().lora.loras;

      forEach(loras, (lora, id) => {
        const isLoRAAvailable = some(
          action.payload.entities,
          (m) =>
            m?.model_name === lora?.model_name &&
            m?.base_model === lora?.base_model
        );

        if (isLoRAAvailable) {
          return;
        }

        dispatch(loraRemoved(id));
      });
    },
  });
  startAppListening({
    matcher: modelsApi.endpoints.getControlNetModels.matchFulfilled,
    effect: async (action, { getState, dispatch }) => {
      // ControlNet models loaded - need to remove missing ControlNets from state
      // TODO: pending model manager controlnet support
    },
  });
};
