import { Flex, Spacer, Text } from '@chakra-ui/react';
import { createSelector } from '@reduxjs/toolkit';
import { stateSelector } from 'app/store/store';
import { useAppDispatch, useAppSelector } from 'app/store/storeHooks';
import { defaultSelectorOptions } from 'app/store/util/defaultMemoizeOptions';
import IAIIconButton from 'common/components/IAIIconButton';
import { useImageUploadButton } from 'common/hooks/useImageUploadButton';
import useImageUploader from 'common/hooks/useImageUploader';
import { clearInitialImage } from 'features/parameters/store/generationSlice';
import { useCallback } from 'react';
import { FaUndo, FaUpload } from 'react-icons/fa';
import { PostUploadAction } from 'services/api/thunks/image';
import InitialImage from './InitialImage';

const selector = createSelector(
  [stateSelector],
  (state) => {
    const { initialImage } = state.generation;
    return {
      isResetButtonDisabled: !initialImage,
    };
  },
  defaultSelectorOptions
);

const postUploadAction: PostUploadAction = {
  type: 'SET_INITIAL_IMAGE',
};

const InitialImageDisplay = () => {
  const { isResetButtonDisabled } = useAppSelector(selector);
  const dispatch = useAppDispatch();
  const { openUploader } = useImageUploader();

  const { getUploadButtonProps, getUploadInputProps } = useImageUploadButton({
    postUploadAction,
  });

  const handleReset = useCallback(() => {
    dispatch(clearInitialImage());
  }, [dispatch]);

  const handleUpload = useCallback(() => {
    openUploader();
  }, [openUploader]);

  return (
    <Flex
      layerStyle={'first'}
      sx={{
        position: 'relative',
        flexDirection: 'column',
        height: 'full',
        width: 'full',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'base',
        p: 4,
        gap: 4,
      }}
    >
      <Flex
        sx={{
          w: 'full',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Text
          sx={{
            fontWeight: 600,
            userSelect: 'none',
            color: 'base.700',
            _dark: {
              color: 'base.200',
            },
          }}
        >
          Initial Image
        </Text>
        <Spacer />
        <IAIIconButton
          tooltip={'Upload Initial Image'}
          aria-label={'Upload Initial Image'}
          icon={<FaUpload />}
          onClick={handleUpload}
          {...getUploadButtonProps()}
        />
        <IAIIconButton
          tooltip={'Reset Initial Image'}
          aria-label={'Reset Initial Image'}
          icon={<FaUndo />}
          onClick={handleReset}
          isDisabled={isResetButtonDisabled}
        />
      </Flex>
      <InitialImage />
      <input {...getUploadInputProps()} />
    </Flex>
  );
};

export default InitialImageDisplay;
