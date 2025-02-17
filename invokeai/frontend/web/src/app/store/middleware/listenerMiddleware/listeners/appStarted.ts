import { createAction } from '@reduxjs/toolkit';
import {
  ASSETS_CATEGORIES,
  IMAGE_CATEGORIES,
  INITIAL_IMAGE_LIMIT,
  isLoadingChanged,
} from 'features/gallery/store/gallerySlice';
import { receivedPageOfImages } from 'services/api/thunks/image';
import { startAppListening } from '..';

export const appStarted = createAction('app/appStarted');

export const addAppStartedListener = () => {
  startAppListening({
    actionCreator: appStarted,
    effect: async (
      action,
      { getState, dispatch, unsubscribe, cancelActiveListeners }
    ) => {
      cancelActiveListeners();
      unsubscribe();
      // fill up the gallery tab with images
      await dispatch(
        receivedPageOfImages({
          categories: IMAGE_CATEGORIES,
          is_intermediate: false,
          offset: 0,
          limit: INITIAL_IMAGE_LIMIT,
        })
      );

      // fill up the assets tab with images
      await dispatch(
        receivedPageOfImages({
          categories: ASSETS_CATEGORIES,
          is_intermediate: false,
          offset: 0,
          limit: INITIAL_IMAGE_LIMIT,
        })
      );

      dispatch(isLoadingChanged(false));
    },
  });
};
