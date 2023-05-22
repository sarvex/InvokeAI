import { UseToastOptions } from '@chakra-ui/react';
import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import * as InvokeAI from 'app/types/invokeai';
import {
  generatorProgress,
  graphExecutionStateComplete,
  invocationComplete,
  invocationError,
  invocationStarted,
  socketConnected,
  socketDisconnected,
  socketSubscribed,
  socketUnsubscribed,
} from 'services/events/actions';

import { ProgressImage } from 'services/events/types';
import { makeToast } from '../../../app/components/Toaster';
import { sessionCanceled, sessionInvoked } from 'services/thunks/session';
import { receivedModels } from 'services/thunks/model';
import { parsedOpenAPISchema } from 'features/nodes/store/nodesSlice';
import { LogLevelName } from 'roarr';
import { InvokeLogLevel } from 'app/logging/useLogger';
import { TFuncKey } from 'i18next';
import { t } from 'i18next';
import { userInvoked } from 'app/store/actions';
import { LANGUAGES } from '../components/LanguagePicker';
import { imageUploaded } from 'services/thunks/image';

export type CancelStrategy = 'immediate' | 'scheduled';

export type InfillMethod = 'tile' | 'patchmatch';

export interface SystemState {
  isGFPGANAvailable: boolean;
  isESRGANAvailable: boolean;
  isConnected: boolean;
  isProcessing: boolean;
  shouldConfirmOnDelete: boolean;
  currentStep: number;
  totalSteps: number;
  currentIteration: number;
  totalIterations: number;
  currentStatusHasSteps: boolean;
  shouldDisplayGuides: boolean;
  isCancelable: boolean;
  enableImageDebugging: boolean;
  toastQueue: UseToastOptions[];
  searchFolder: string | null;
  foundModels: InvokeAI.FoundModel[] | null;
  openModel: string | null;
  /**
   * The current progress image
   */
  progressImage: ProgressImage | null;
  /**
   * The current socket session id
   */
  sessionId: string | null;
  /**
   * Cancel strategy
   */
  cancelType: CancelStrategy;
  /**
   * Whether or not a scheduled cancelation is pending
   */
  isCancelScheduled: boolean;
  /**
   * Array of node IDs that we want to handle when events received
   */
  subscribedNodeIds: string[];
  /**
   * Whether or not the available models were received
   */
  wereModelsReceived: boolean;
  /**
   * Whether or not the OpenAPI schema was received and parsed
   */
  wasSchemaParsed: boolean;
  /**
   * The console output logging level
   */
  consoleLogLevel: InvokeLogLevel;
  shouldLogToConsole: boolean;
  statusTranslationKey: TFuncKey;
  /**
   * When a session is canceled, its ID is stored here until a new session is created.
   */
  canceledSession: string;
  /**
   * TODO: get this from backend
   */
  infillMethods: InfillMethod[];
  isPersisted: boolean;
  shouldAntialiasProgressImage: boolean;
  language: keyof typeof LANGUAGES;
  isUploading: boolean;
}

export const initialSystemState: SystemState = {
  isConnected: false,
  isProcessing: false,
  shouldDisplayGuides: true,
  isGFPGANAvailable: true,
  isESRGANAvailable: true,
  shouldConfirmOnDelete: true,
  currentStep: 0,
  totalSteps: 0,
  currentIteration: 0,
  totalIterations: 0,
  currentStatusHasSteps: false,
  isCancelable: true,
  enableImageDebugging: false,
  toastQueue: [],
  searchFolder: null,
  foundModels: null,
  openModel: null,
  progressImage: null,
  shouldAntialiasProgressImage: false,
  sessionId: null,
  cancelType: 'immediate',
  isCancelScheduled: false,
  subscribedNodeIds: [],
  wereModelsReceived: false,
  wasSchemaParsed: false,
  consoleLogLevel: 'debug',
  shouldLogToConsole: true,
  statusTranslationKey: 'common.statusDisconnected',
  canceledSession: '',
  infillMethods: ['tile', 'patchmatch'],
  isPersisted: false,
  language: 'en',
  isUploading: false,
};

export const systemSlice = createSlice({
  name: 'system',
  initialState: initialSystemState,
  reducers: {
    setIsProcessing: (state, action: PayloadAction<boolean>) => {
      state.isProcessing = action.payload;
    },
    setCurrentStatus: (state, action: PayloadAction<TFuncKey>) => {
      state.statusTranslationKey = action.payload;
    },
    setShouldConfirmOnDelete: (state, action: PayloadAction<boolean>) => {
      state.shouldConfirmOnDelete = action.payload;
    },
    setShouldDisplayGuides: (state, action: PayloadAction<boolean>) => {
      state.shouldDisplayGuides = action.payload;
    },
    setIsCancelable: (state, action: PayloadAction<boolean>) => {
      state.isCancelable = action.payload;
    },
    setEnableImageDebugging: (state, action: PayloadAction<boolean>) => {
      state.enableImageDebugging = action.payload;
    },
    addToast: (state, action: PayloadAction<UseToastOptions>) => {
      state.toastQueue.push(action.payload);
    },
    clearToastQueue: (state) => {
      state.toastQueue = [];
    },
    setSearchFolder: (state, action: PayloadAction<string | null>) => {
      state.searchFolder = action.payload;
    },
    setFoundModels: (
      state,
      action: PayloadAction<InvokeAI.FoundModel[] | null>
    ) => {
      state.foundModels = action.payload;
    },
    setOpenModel: (state, action: PayloadAction<string | null>) => {
      state.openModel = action.payload;
    },
    /**
     * A cancel was scheduled
     */
    cancelScheduled: (state) => {
      state.isCancelScheduled = true;
    },
    /**
     * The scheduled cancel was aborted
     */
    scheduledCancelAborted: (state) => {
      state.isCancelScheduled = false;
    },
    /**
     * The cancel type was changed
     */
    cancelTypeChanged: (state, action: PayloadAction<CancelStrategy>) => {
      state.cancelType = action.payload;
    },
    /**
     * The array of subscribed node ids was changed
     */
    subscribedNodeIdsSet: (state, action: PayloadAction<string[]>) => {
      state.subscribedNodeIds = action.payload;
    },
    consoleLogLevelChanged: (state, action: PayloadAction<LogLevelName>) => {
      state.consoleLogLevel = action.payload;
    },
    shouldLogToConsoleChanged: (state, action: PayloadAction<boolean>) => {
      state.shouldLogToConsole = action.payload;
    },
    shouldAntialiasProgressImageChanged: (
      state,
      action: PayloadAction<boolean>
    ) => {
      state.shouldAntialiasProgressImage = action.payload;
    },
    isPersistedChanged: (state, action: PayloadAction<boolean>) => {
      state.isPersisted = action.payload;
    },
    languageChanged: (state, action: PayloadAction<keyof typeof LANGUAGES>) => {
      state.language = action.payload;
    },
  },
  extraReducers(builder) {
    /**
     * Socket Subscribed
     */
    builder.addCase(socketSubscribed, (state, action) => {
      state.sessionId = action.payload.sessionId;
      state.canceledSession = '';
    });

    /**
     * Socket Unsubscribed
     */
    builder.addCase(socketUnsubscribed, (state) => {
      state.sessionId = null;
    });

    /**
     * Socket Connected
     */
    builder.addCase(socketConnected, (state) => {
      state.isConnected = true;
      state.isCancelable = true;
      state.isProcessing = false;
      state.currentStatusHasSteps = false;
      state.currentStep = 0;
      state.totalSteps = 0;
      state.currentIteration = 0;
      state.totalIterations = 0;
      state.statusTranslationKey = 'common.statusConnected';
    });

    /**
     * Socket Disconnected
     */
    builder.addCase(socketDisconnected, (state) => {
      state.isConnected = false;
      state.isProcessing = false;
      state.isCancelable = true;
      state.currentStatusHasSteps = false;
      state.currentStep = 0;
      state.totalSteps = 0;
      // state.currentIteration = 0;
      // state.totalIterations = 0;
      state.statusTranslationKey = 'common.statusDisconnected';
    });

    /**
     * Invocation Started
     */
    builder.addCase(invocationStarted, (state) => {
      state.isCancelable = true;
      state.isProcessing = true;
      state.currentStatusHasSteps = false;
      state.currentStep = 0;
      state.totalSteps = 0;
      // state.currentIteration = 0;
      // state.totalIterations = 0;
      state.statusTranslationKey = 'common.statusGenerating';
    });

    /**
     * Generator Progress
     */
    builder.addCase(generatorProgress, (state, action) => {
      const { step, total_steps, progress_image } = action.payload.data;

      state.isProcessing = true;
      state.isCancelable = true;
      // state.currentIteration = 0;
      // state.totalIterations = 0;
      state.currentStatusHasSteps = true;
      state.currentStep = step + 1; // TODO: step starts at -1, think this is a bug
      state.totalSteps = total_steps;
      state.progressImage = progress_image ?? null;
      state.statusTranslationKey = 'common.statusGenerating';
    });

    /**
     * Invocation Complete
     */
    builder.addCase(invocationComplete, (state, action) => {
      const { data } = action.payload;

      // state.currentIteration = 0;
      // state.totalIterations = 0;
      state.currentStatusHasSteps = false;
      state.currentStep = 0;
      state.totalSteps = 0;
      state.statusTranslationKey = 'common.statusProcessingComplete';
      state.progressImage = null;

      if (state.canceledSession === data.graph_execution_state_id) {
        state.isProcessing = false;
        state.isCancelable = true;
      }
    });

    /**
     * Invocation Error
     */
    builder.addCase(invocationError, (state) => {
      state.isProcessing = false;
      state.isCancelable = true;
      // state.currentIteration = 0;
      // state.totalIterations = 0;
      state.currentStatusHasSteps = false;
      state.currentStep = 0;
      state.totalSteps = 0;
      state.statusTranslationKey = 'common.statusError';
      state.progressImage = null;

      state.toastQueue.push(
        makeToast({ title: t('toast.serverError'), status: 'error' })
      );
    });

    /**
     * Session Invoked - PENDING
     */

    builder.addCase(userInvoked, (state) => {
      state.isProcessing = true;
      state.isCancelable = true;
      state.currentStatusHasSteps = false;
      state.statusTranslationKey = 'common.statusPreparing';
    });

    builder.addCase(sessionInvoked.rejected, (state, action) => {
      const error = action.payload as string | undefined;
      state.toastQueue.push(
        makeToast({ title: error || t('toast.serverError'), status: 'error' })
      );
    });

    /**
     * Session Canceled
     */
    builder.addCase(sessionCanceled.fulfilled, (state, action) => {
      state.canceledSession = action.meta.arg.sessionId;
      state.isProcessing = false;
      state.isCancelable = false;
      state.isCancelScheduled = false;
      state.currentStep = 0;
      state.totalSteps = 0;
      state.statusTranslationKey = 'common.statusConnected';
      state.progressImage = null;

      state.toastQueue.push(
        makeToast({ title: t('toast.canceled'), status: 'warning' })
      );
    });

    /**
     * Session Canceled
     */
    builder.addCase(graphExecutionStateComplete, (state) => {
      state.isProcessing = false;
      state.isCancelable = false;
      state.isCancelScheduled = false;
      state.currentStep = 0;
      state.totalSteps = 0;
      state.statusTranslationKey = 'common.statusConnected';
    });

    /**
     * Received available models from the backend
     */
    builder.addCase(receivedModels.fulfilled, (state) => {
      state.wereModelsReceived = true;
    });

    /**
     * OpenAPI schema was parsed
     */
    builder.addCase(parsedOpenAPISchema, (state) => {
      state.wasSchemaParsed = true;
    });

    /**
     * Image Uploading Started
     */
    builder.addCase(imageUploaded.pending, (state) => {
      state.isUploading = true;
    });

    /**
     * Image Uploading Complete
     */
    builder.addCase(imageUploaded.rejected, (state) => {
      state.isUploading = false;
    });

    /**
     * Image Uploading Complete
     */
    builder.addCase(imageUploaded.fulfilled, (state) => {
      state.isUploading = false;
    });
  },
});

export const {
  setIsProcessing,
  setShouldConfirmOnDelete,
  setCurrentStatus,
  setShouldDisplayGuides,
  setIsCancelable,
  setEnableImageDebugging,
  addToast,
  clearToastQueue,
  setSearchFolder,
  setFoundModels,
  setOpenModel,
  cancelScheduled,
  scheduledCancelAborted,
  cancelTypeChanged,
  subscribedNodeIdsSet,
  consoleLogLevelChanged,
  shouldLogToConsoleChanged,
  isPersistedChanged,
  shouldAntialiasProgressImageChanged,
  languageChanged,
} = systemSlice.actions;

export default systemSlice.reducer;
