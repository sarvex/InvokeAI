import { createSelector } from '@reduxjs/toolkit';
import { isEqual } from 'lodash-es';

import { ButtonGroup, Flex, FlexProps, Link } from '@chakra-ui/react';
// import { runESRGAN, runFacetool } from 'app/socketio/actions';
import { useAppDispatch, useAppSelector } from 'app/store/storeHooks';
import IAIButton from 'common/components/IAIButton';
import IAIIconButton from 'common/components/IAIIconButton';
import IAIPopover from 'common/components/IAIPopover';

import { skipToken } from '@reduxjs/toolkit/dist/query';
import { useAppToaster } from 'app/components/Toaster';
import { stateSelector } from 'app/store/store';
import { setInitialCanvasImage } from 'features/canvas/store/canvasSlice';
import { requestCanvasRescale } from 'features/canvas/store/thunks/requestCanvasScale';
import { DeleteImageButton } from 'features/imageDeletion/components/DeleteImageButton';
import { imageToDeleteSelected } from 'features/imageDeletion/store/imageDeletionSlice';
import FaceRestoreSettings from 'features/parameters/components/Parameters/FaceRestore/FaceRestoreSettings';
import UpscaleSettings from 'features/parameters/components/Parameters/Upscale/UpscaleSettings';
import { useRecallParameters } from 'features/parameters/hooks/useRecallParameters';
import { initialImageSelected } from 'features/parameters/store/actions';
import { useFeatureStatus } from 'features/system/hooks/useFeatureStatus';
import { activeTabNameSelector } from 'features/ui/store/uiSelectors';
import {
  setActiveTab,
  setShouldShowImageDetails,
  setShouldShowProgressInViewer,
} from 'features/ui/store/uiSlice';
import { useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTranslation } from 'react-i18next';
import {
  FaAsterisk,
  FaCode,
  FaCopy,
  FaDownload,
  FaExpandArrowsAlt,
  FaGrinStars,
  FaHourglassHalf,
  FaQuoteRight,
  FaSeedling,
  FaShare,
  FaShareAlt,
} from 'react-icons/fa';
import {
  useGetImageDTOQuery,
  useGetImageMetadataQuery,
} from 'services/api/endpoints/images';
import { useDebounce } from 'use-debounce';
import { sentImageToCanvas, sentImageToImg2Img } from '../../store/actions';

const currentImageButtonsSelector = createSelector(
  [stateSelector, activeTabNameSelector],
  ({ gallery, system, postprocessing, ui }, activeTabName) => {
    const {
      isProcessing,
      isConnected,
      isGFPGANAvailable,
      isESRGANAvailable,
      shouldConfirmOnDelete,
      progressImage,
    } = system;

    const { upscalingLevel, facetoolStrength } = postprocessing;

    const {
      shouldShowImageDetails,
      shouldHidePreview,
      shouldShowProgressInViewer,
    } = ui;

    const lastSelectedImage = gallery.selection[gallery.selection.length - 1];

    return {
      canDeleteImage: isConnected && !isProcessing,
      shouldConfirmOnDelete,
      isProcessing,
      isConnected,
      isGFPGANAvailable,
      isESRGANAvailable,
      upscalingLevel,
      facetoolStrength,
      shouldDisableToolbarButtons: Boolean(progressImage) || !lastSelectedImage,
      shouldShowImageDetails,
      activeTabName,
      shouldHidePreview,
      shouldShowProgressInViewer,
      lastSelectedImage,
    };
  },
  {
    memoizeOptions: {
      resultEqualityCheck: isEqual,
    },
  }
);

type CurrentImageButtonsProps = FlexProps;

const CurrentImageButtons = (props: CurrentImageButtonsProps) => {
  const dispatch = useAppDispatch();
  const {
    isProcessing,
    isConnected,
    isGFPGANAvailable,
    isESRGANAvailable,
    upscalingLevel,
    facetoolStrength,
    shouldDisableToolbarButtons,
    shouldShowImageDetails,
    activeTabName,
    lastSelectedImage,
    shouldShowProgressInViewer,
  } = useAppSelector(currentImageButtonsSelector);

  const isCanvasEnabled = useFeatureStatus('unifiedCanvas').isFeatureEnabled;
  const isUpscalingEnabled = useFeatureStatus('upscaling').isFeatureEnabled;
  const isFaceRestoreEnabled = useFeatureStatus('faceRestore').isFeatureEnabled;

  const toaster = useAppToaster();
  const { t } = useTranslation();

  const { recallBothPrompts, recallSeed, recallAllParameters } =
    useRecallParameters();

  const [debouncedMetadataQueryArg, debounceState] = useDebounce(
    lastSelectedImage,
    500
  );

  const { currentData: image, isFetching } = useGetImageDTOQuery(
    lastSelectedImage ?? skipToken
  );

  const { currentData: metadataData } = useGetImageMetadataQuery(
    debounceState.isPending()
      ? skipToken
      : debouncedMetadataQueryArg ?? skipToken
  );

  const metadata = metadataData?.metadata;

  const handleCopyImageLink = useCallback(() => {
    const getImageUrl = () => {
      if (!image) {
        return;
      }

      if (image.image_url.startsWith('http')) {
        return image.image_url;
      }

      return window.location.toString() + image.image_url;
    };

    const url = getImageUrl();

    if (!url) {
      toaster({
        title: t('toast.problemCopyingImageLink'),
        status: 'error',
        duration: 2500,
        isClosable: true,
      });

      return;
    }

    navigator.clipboard.writeText(url).then(() => {
      toaster({
        title: t('toast.imageLinkCopied'),
        status: 'success',
        duration: 2500,
        isClosable: true,
      });
    });
  }, [toaster, t, image]);

  const handleClickUseAllParameters = useCallback(() => {
    recallAllParameters(metadata);
  }, [metadata, recallAllParameters]);

  useHotkeys(
    'a',
    () => {
      handleClickUseAllParameters;
    },
    [metadata, recallAllParameters]
  );

  const handleUseSeed = useCallback(() => {
    recallSeed(metadata?.seed);
  }, [metadata?.seed, recallSeed]);

  useHotkeys('s', handleUseSeed, [image]);

  const handleUsePrompt = useCallback(() => {
    recallBothPrompts(metadata?.positive_prompt, metadata?.negative_prompt);
  }, [metadata?.negative_prompt, metadata?.positive_prompt, recallBothPrompts]);

  useHotkeys('p', handleUsePrompt, [image]);

  const handleSendToImageToImage = useCallback(() => {
    dispatch(sentImageToImg2Img());
    dispatch(initialImageSelected(image));
  }, [dispatch, image]);

  useHotkeys('shift+i', handleSendToImageToImage, [image]);

  const handleClickUpscale = useCallback(() => {
    // selectedImage && dispatch(runESRGAN(selectedImage));
  }, []);

  const handleDelete = useCallback(() => {
    if (!image) {
      return;
    }
    dispatch(imageToDeleteSelected(image));
  }, [dispatch, image]);

  useHotkeys(
    'Shift+U',
    () => {
      handleClickUpscale();
    },
    {
      enabled: () =>
        Boolean(
          isUpscalingEnabled &&
            isESRGANAvailable &&
            !shouldDisableToolbarButtons &&
            isConnected &&
            !isProcessing &&
            upscalingLevel
        ),
    },
    [
      isUpscalingEnabled,
      image,
      isESRGANAvailable,
      shouldDisableToolbarButtons,
      isConnected,
      isProcessing,
      upscalingLevel,
    ]
  );

  const handleClickFixFaces = useCallback(() => {
    // selectedImage && dispatch(runFacetool(selectedImage));
  }, []);

  useHotkeys(
    'Shift+R',
    () => {
      handleClickFixFaces();
    },
    {
      enabled: () =>
        Boolean(
          isFaceRestoreEnabled &&
            isGFPGANAvailable &&
            !shouldDisableToolbarButtons &&
            isConnected &&
            !isProcessing &&
            facetoolStrength
        ),
    },

    [
      isFaceRestoreEnabled,
      image,
      isGFPGANAvailable,
      shouldDisableToolbarButtons,
      isConnected,
      isProcessing,
      facetoolStrength,
    ]
  );

  const handleClickShowImageDetails = useCallback(
    () => dispatch(setShouldShowImageDetails(!shouldShowImageDetails)),
    [dispatch, shouldShowImageDetails]
  );

  const handleSendToCanvas = useCallback(() => {
    if (!image) return;
    dispatch(sentImageToCanvas());

    dispatch(setInitialCanvasImage(image));
    dispatch(requestCanvasRescale());

    if (activeTabName !== 'unifiedCanvas') {
      dispatch(setActiveTab('unifiedCanvas'));
    }

    toaster({
      title: t('toast.sentToUnifiedCanvas'),
      status: 'success',
      duration: 2500,
      isClosable: true,
    });
  }, [image, dispatch, activeTabName, toaster, t]);

  useHotkeys(
    'i',
    () => {
      if (image) {
        handleClickShowImageDetails();
      } else {
        toaster({
          title: t('toast.metadataLoadFailed'),
          status: 'error',
          duration: 2500,
          isClosable: true,
        });
      }
    },
    [image, shouldShowImageDetails, toaster]
  );

  const handleClickProgressImagesToggle = useCallback(() => {
    dispatch(setShouldShowProgressInViewer(!shouldShowProgressInViewer));
  }, [dispatch, shouldShowProgressInViewer]);

  return (
    <>
      <Flex
        sx={{
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 2,
        }}
        {...props}
      >
        <ButtonGroup isAttached={true} isDisabled={shouldDisableToolbarButtons}>
          <IAIPopover
            triggerComponent={
              <IAIIconButton
                aria-label={`${t('parameters.sendTo')}...`}
                tooltip={`${t('parameters.sendTo')}...`}
                isDisabled={!image}
                icon={<FaShareAlt />}
              />
            }
          >
            <Flex
              sx={{
                flexDirection: 'column',
                rowGap: 2,
              }}
            >
              <IAIButton
                size="sm"
                onClick={handleSendToImageToImage}
                leftIcon={<FaShare />}
                id="send-to-img2img"
              >
                {t('parameters.sendToImg2Img')}
              </IAIButton>
              {isCanvasEnabled && (
                <IAIButton
                  size="sm"
                  onClick={handleSendToCanvas}
                  leftIcon={<FaShare />}
                  id="send-to-canvas"
                >
                  {t('parameters.sendToUnifiedCanvas')}
                </IAIButton>
              )}

              {/* <IAIButton
                size="sm"
                onClick={handleCopyImage}
                leftIcon={<FaCopy />}
              >
                {t('parameters.copyImage')}
              </IAIButton> */}
              <IAIButton
                size="sm"
                onClick={handleCopyImageLink}
                leftIcon={<FaCopy />}
              >
                {t('parameters.copyImageToLink')}
              </IAIButton>

              <Link download={true} href={image?.image_url} target="_blank">
                <IAIButton leftIcon={<FaDownload />} size="sm" w="100%">
                  {t('parameters.downloadImage')}
                </IAIButton>
              </Link>
            </Flex>
          </IAIPopover>
        </ButtonGroup>

        <ButtonGroup isAttached={true} isDisabled={shouldDisableToolbarButtons}>
          <IAIIconButton
            icon={<FaQuoteRight />}
            tooltip={`${t('parameters.usePrompt')} (P)`}
            aria-label={`${t('parameters.usePrompt')} (P)`}
            isDisabled={!metadata?.positive_prompt}
            onClick={handleUsePrompt}
          />

          <IAIIconButton
            icon={<FaSeedling />}
            tooltip={`${t('parameters.useSeed')} (S)`}
            aria-label={`${t('parameters.useSeed')} (S)`}
            isDisabled={!metadata?.seed}
            onClick={handleUseSeed}
          />

          <IAIIconButton
            icon={<FaAsterisk />}
            tooltip={`${t('parameters.useAll')} (A)`}
            aria-label={`${t('parameters.useAll')} (A)`}
            isDisabled={!metadata}
            onClick={handleClickUseAllParameters}
          />
        </ButtonGroup>

        {(isUpscalingEnabled || isFaceRestoreEnabled) && (
          <ButtonGroup
            isAttached={true}
            isDisabled={shouldDisableToolbarButtons}
          >
            {isFaceRestoreEnabled && (
              <IAIPopover
                triggerComponent={
                  <IAIIconButton
                    icon={<FaGrinStars />}
                    aria-label={t('parameters.restoreFaces')}
                  />
                }
              >
                <Flex
                  sx={{
                    flexDirection: 'column',
                    rowGap: 4,
                  }}
                >
                  <FaceRestoreSettings />
                  <IAIButton
                    isDisabled={
                      !isGFPGANAvailable ||
                      !image ||
                      !(isConnected && !isProcessing) ||
                      !facetoolStrength
                    }
                    onClick={handleClickFixFaces}
                  >
                    {t('parameters.restoreFaces')}
                  </IAIButton>
                </Flex>
              </IAIPopover>
            )}

            {isUpscalingEnabled && (
              <IAIPopover
                triggerComponent={
                  <IAIIconButton
                    icon={<FaExpandArrowsAlt />}
                    aria-label={t('parameters.upscale')}
                  />
                }
              >
                <Flex
                  sx={{
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <UpscaleSettings />
                  <IAIButton
                    isDisabled={
                      !isESRGANAvailable ||
                      !image ||
                      !(isConnected && !isProcessing) ||
                      !upscalingLevel
                    }
                    onClick={handleClickUpscale}
                  >
                    {t('parameters.upscaleImage')}
                  </IAIButton>
                </Flex>
              </IAIPopover>
            )}
          </ButtonGroup>
        )}

        <ButtonGroup isAttached={true} isDisabled={shouldDisableToolbarButtons}>
          <IAIIconButton
            icon={<FaCode />}
            tooltip={`${t('parameters.info')} (I)`}
            aria-label={`${t('parameters.info')} (I)`}
            isChecked={shouldShowImageDetails}
            onClick={handleClickShowImageDetails}
          />
        </ButtonGroup>

        <ButtonGroup isAttached={true}>
          <IAIIconButton
            aria-label={t('settings.displayInProgress')}
            tooltip={t('settings.displayInProgress')}
            icon={<FaHourglassHalf />}
            isChecked={shouldShowProgressInViewer}
            onClick={handleClickProgressImagesToggle}
          />
        </ButtonGroup>

        <ButtonGroup isAttached={true}>
          <DeleteImageButton
            onClick={handleDelete}
            isDisabled={shouldDisableToolbarButtons}
          />
        </ButtonGroup>
      </Flex>
    </>
  );
};

export default CurrentImageButtons;
