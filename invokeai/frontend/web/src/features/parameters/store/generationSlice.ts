import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import * as InvokeAI from 'app/types/invokeai';
import promptToString from 'common/util/promptToString';
import { clamp, sample } from 'lodash-es';
import { setAllParametersReducer } from './setAllParametersReducer';
import { receivedModels } from 'services/thunks/model';
import { Scheduler } from 'app/constants';
import { ImageDTO } from 'services/api';

export interface GenerationState {
  cfgScale: number;
  height: number;
  img2imgStrength: number;
  infillMethod: string;
  initialImage?: ImageDTO;
  iterations: number;
  perlin: number;
  positivePrompt: string;
  negativePrompt: string;
  scheduler: Scheduler;
  seamBlur: number;
  seamSize: number;
  seamSteps: number;
  seamStrength: number;
  seed: number;
  seedWeights: string;
  shouldFitToWidthHeight: boolean;
  shouldGenerateVariations: boolean;
  shouldRandomizeSeed: boolean;
  shouldUseNoiseSettings: boolean;
  steps: number;
  threshold: number;
  tileSize: number;
  variationAmount: number;
  width: number;
  shouldUseSymmetry: boolean;
  horizontalSymmetrySteps: number;
  verticalSymmetrySteps: number;
  model: string;
  shouldUseSeamless: boolean;
  seamlessXAxis: boolean;
  seamlessYAxis: boolean;
}

export const initialGenerationState: GenerationState = {
  cfgScale: 7.5,
  height: 512,
  img2imgStrength: 0.75,
  infillMethod: 'patchmatch',
  iterations: 1,
  perlin: 0,
  positivePrompt: '',
  negativePrompt: '',
  scheduler: 'lms',
  seamBlur: 16,
  seamSize: 96,
  seamSteps: 30,
  seamStrength: 0.7,
  seed: 0,
  seedWeights: '',
  shouldFitToWidthHeight: true,
  shouldGenerateVariations: false,
  shouldRandomizeSeed: true,
  shouldUseNoiseSettings: false,
  steps: 50,
  threshold: 0,
  tileSize: 32,
  variationAmount: 0.1,
  width: 512,
  shouldUseSymmetry: false,
  horizontalSymmetrySteps: 0,
  verticalSymmetrySteps: 0,
  model: '',
  shouldUseSeamless: false,
  seamlessXAxis: true,
  seamlessYAxis: true,
};

const initialState: GenerationState = initialGenerationState;

export const generationSlice = createSlice({
  name: 'generation',
  initialState,
  reducers: {
    setPositivePrompt: (
      state,
      action: PayloadAction<string | InvokeAI.Prompt>
    ) => {
      const newPrompt = action.payload;
      if (typeof newPrompt === 'string') {
        state.positivePrompt = newPrompt;
      } else {
        state.positivePrompt = promptToString(newPrompt);
      }
    },
    setNegativePrompt: (
      state,
      action: PayloadAction<string | InvokeAI.Prompt>
    ) => {
      const newPrompt = action.payload;
      if (typeof newPrompt === 'string') {
        state.negativePrompt = newPrompt;
      } else {
        state.negativePrompt = promptToString(newPrompt);
      }
    },
    setIterations: (state, action: PayloadAction<number>) => {
      state.iterations = action.payload;
    },
    setSteps: (state, action: PayloadAction<number>) => {
      state.steps = action.payload;
    },
    clampSymmetrySteps: (state) => {
      state.horizontalSymmetrySteps = clamp(
        state.horizontalSymmetrySteps,
        0,
        state.steps
      );
      state.verticalSymmetrySteps = clamp(
        state.verticalSymmetrySteps,
        0,
        state.steps
      );
    },
    setCfgScale: (state, action: PayloadAction<number>) => {
      state.cfgScale = action.payload;
    },
    setThreshold: (state, action: PayloadAction<number>) => {
      state.threshold = action.payload;
    },
    setPerlin: (state, action: PayloadAction<number>) => {
      state.perlin = action.payload;
    },
    setHeight: (state, action: PayloadAction<number>) => {
      state.height = action.payload;
    },
    setWidth: (state, action: PayloadAction<number>) => {
      state.width = action.payload;
    },
    setScheduler: (state, action: PayloadAction<Scheduler>) => {
      state.scheduler = action.payload;
    },
    setSeed: (state, action: PayloadAction<number>) => {
      state.seed = action.payload;
      state.shouldRandomizeSeed = false;
    },
    setImg2imgStrength: (state, action: PayloadAction<number>) => {
      state.img2imgStrength = action.payload;
    },
    setSeamless: (state, action: PayloadAction<boolean>) => {
      state.shouldUseSeamless = action.payload;
    },
    setSeamlessXAxis: (state, action: PayloadAction<boolean>) => {
      state.seamlessXAxis = action.payload;
    },
    setSeamlessYAxis: (state, action: PayloadAction<boolean>) => {
      state.seamlessYAxis = action.payload;
    },
    setShouldFitToWidthHeight: (state, action: PayloadAction<boolean>) => {
      state.shouldFitToWidthHeight = action.payload;
    },
    resetSeed: (state) => {
      state.seed = -1;
    },
    setShouldGenerateVariations: (state, action: PayloadAction<boolean>) => {
      state.shouldGenerateVariations = action.payload;
    },
    setVariationAmount: (state, action: PayloadAction<number>) => {
      state.variationAmount = action.payload;
    },
    setSeedWeights: (state, action: PayloadAction<string>) => {
      state.seedWeights = action.payload;
      state.shouldGenerateVariations = true;
      state.variationAmount = 0;
    },
    allParametersSet: setAllParametersReducer,
    resetParametersState: (state) => {
      return {
        ...state,
        ...initialGenerationState,
      };
    },
    setShouldRandomizeSeed: (state, action: PayloadAction<boolean>) => {
      state.shouldRandomizeSeed = action.payload;
    },
    clearInitialImage: (state) => {
      state.initialImage = undefined;
    },
    setSeamSize: (state, action: PayloadAction<number>) => {
      state.seamSize = action.payload;
    },
    setSeamBlur: (state, action: PayloadAction<number>) => {
      state.seamBlur = action.payload;
    },
    setSeamStrength: (state, action: PayloadAction<number>) => {
      state.seamStrength = action.payload;
    },
    setSeamSteps: (state, action: PayloadAction<number>) => {
      state.seamSteps = action.payload;
    },
    setTileSize: (state, action: PayloadAction<number>) => {
      state.tileSize = action.payload;
    },
    setInfillMethod: (state, action: PayloadAction<string>) => {
      state.infillMethod = action.payload;
    },
    setShouldUseSymmetry: (state, action: PayloadAction<boolean>) => {
      state.shouldUseSymmetry = action.payload;
    },
    setHorizontalSymmetrySteps: (state, action: PayloadAction<number>) => {
      state.horizontalSymmetrySteps = action.payload;
    },
    setVerticalSymmetrySteps: (state, action: PayloadAction<number>) => {
      state.verticalSymmetrySteps = action.payload;
    },
    setShouldUseNoiseSettings: (state, action: PayloadAction<boolean>) => {
      state.shouldUseNoiseSettings = action.payload;
    },
    initialImageChanged: (state, action: PayloadAction<ImageDTO>) => {
      state.initialImage = action.payload;
    },
    modelSelected: (state, action: PayloadAction<string>) => {
      state.model = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(receivedModels.fulfilled, (state, action) => {
      if (!state.model) {
        const randomModel = sample(action.payload);
        if (randomModel) {
          state.model = randomModel.name;
        }
      }
    });
  },
});

export const {
  clampSymmetrySteps,
  clearInitialImage,
  resetParametersState,
  resetSeed,
  setCfgScale,
  setHeight,
  setImg2imgStrength,
  setInfillMethod,
  setIterations,
  setPerlin,
  setPositivePrompt,
  setNegativePrompt,
  setScheduler,
  setSeamBlur,
  setSeamSize,
  setSeamSteps,
  setSeamStrength,
  setSeed,
  setSeedWeights,
  setShouldFitToWidthHeight,
  setShouldGenerateVariations,
  setShouldRandomizeSeed,
  setSteps,
  setThreshold,
  setTileSize,
  setVariationAmount,
  setWidth,
  setShouldUseSymmetry,
  setHorizontalSymmetrySteps,
  setVerticalSymmetrySteps,
  initialImageChanged,
  modelSelected,
  setShouldUseNoiseSettings,
  setSeamless,
  setSeamlessXAxis,
  setSeamlessYAxis,
  allParametersSet,
} = generationSlice.actions;

export default generationSlice.reducer;
