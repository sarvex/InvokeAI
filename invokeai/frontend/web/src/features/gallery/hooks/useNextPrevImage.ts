import { createSelector } from '@reduxjs/toolkit';
import { stateSelector } from 'app/store/store';
import { useAppDispatch, useAppSelector } from 'app/store/storeHooks';
import {
  imageSelected,
  selectImagesById,
} from 'features/gallery/store/gallerySlice';
import { clamp, isEqual } from 'lodash-es';
import { useCallback } from 'react';
import { receivedPageOfImages } from 'services/api/thunks/image';
import { selectFilteredImages } from '../store/gallerySelectors';

export const nextPrevImageButtonsSelector = createSelector(
  [stateSelector, selectFilteredImages],
  (state, filteredImages) => {
    const { total, isFetching } = state.gallery;
    const lastSelectedImage =
      state.gallery.selection[state.gallery.selection.length - 1];

    if (!lastSelectedImage || filteredImages.length === 0) {
      return {
        isOnFirstImage: true,
        isOnLastImage: true,
      };
    }

    const currentImageIndex = filteredImages.findIndex(
      (i) => i.image_name === lastSelectedImage
    );
    const nextImageIndex = clamp(
      currentImageIndex + 1,
      0,
      filteredImages.length - 1
    );

    const prevImageIndex = clamp(
      currentImageIndex - 1,
      0,
      filteredImages.length - 1
    );

    const nextImageId = filteredImages[nextImageIndex].image_name;
    const prevImageId = filteredImages[prevImageIndex].image_name;

    const nextImage = selectImagesById(state, nextImageId);
    const prevImage = selectImagesById(state, prevImageId);

    const imagesLength = filteredImages.length;

    return {
      isOnFirstImage: currentImageIndex === 0,
      isOnLastImage:
        !isNaN(currentImageIndex) && currentImageIndex === imagesLength - 1,
      areMoreImagesAvailable: total > imagesLength,
      isFetching,
      nextImage,
      prevImage,
      nextImageId,
      prevImageId,
    };
  },
  {
    memoizeOptions: {
      resultEqualityCheck: isEqual,
    },
  }
);

export const useNextPrevImage = () => {
  const dispatch = useAppDispatch();

  const {
    isOnFirstImage,
    isOnLastImage,
    nextImageId,
    prevImageId,
    areMoreImagesAvailable,
    isFetching,
  } = useAppSelector(nextPrevImageButtonsSelector);

  const handlePrevImage = useCallback(() => {
    prevImageId && dispatch(imageSelected(prevImageId));
  }, [dispatch, prevImageId]);

  const handleNextImage = useCallback(() => {
    nextImageId && dispatch(imageSelected(nextImageId));
  }, [dispatch, nextImageId]);

  const handleLoadMoreImages = useCallback(() => {
    dispatch(
      receivedPageOfImages({
        is_intermediate: false,
      })
    );
  }, [dispatch]);

  return {
    handlePrevImage,
    handleNextImage,
    isOnFirstImage,
    isOnLastImage,
    nextImageId,
    prevImageId,
    areMoreImagesAvailable,
    handleLoadMoreImages,
    isFetching,
  };
};
