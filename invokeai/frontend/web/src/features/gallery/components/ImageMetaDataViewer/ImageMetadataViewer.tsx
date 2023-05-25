import { ExternalLinkIcon } from '@chakra-ui/icons';
import {
  Box,
  Center,
  Flex,
  IconButton,
  Link,
  Text,
  Tooltip,
} from '@chakra-ui/react';
import * as InvokeAI from 'app/types/invokeai';
import { useAppDispatch } from 'app/store/storeHooks';
import { useGetUrl } from 'common/util/getUrl';
import promptToString from 'common/util/promptToString';
import { seedWeightsToString } from 'common/util/seedWeightPairs';
import useSetBothPrompts from 'features/parameters/hooks/usePrompt';
import {
  setCfgScale,
  setHeight,
  setImg2imgStrength,
  setNegativePrompt,
  setPerlin,
  setPositivePrompt,
  setScheduler,
  setSeamless,
  setSeed,
  setSeedWeights,
  setShouldFitToWidthHeight,
  setSteps,
  setThreshold,
  setWidth,
} from 'features/parameters/store/generationSlice';
import { setHiresFix } from 'features/parameters/store/postprocessingSlice';
import { setShouldShowImageDetails } from 'features/ui/store/uiSlice';
import { memo } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTranslation } from 'react-i18next';
import { FaCopy } from 'react-icons/fa';
import { IoArrowUndoCircleOutline } from 'react-icons/io5';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import { ImageDTO } from 'services/api';
import { filter } from 'lodash-es';
import { Scheduler } from 'app/constants';

type MetadataItemProps = {
  isLink?: boolean;
  label: string;
  onClick?: () => void;
  value: number | string | boolean;
  labelPosition?: string;
  withCopy?: boolean;
};

/**
 * Component to display an individual metadata item or parameter.
 */
const MetadataItem = ({
  label,
  value,
  onClick,
  isLink,
  labelPosition,
  withCopy = false,
}: MetadataItemProps) => {
  const { t } = useTranslation();
  return (
    <Flex gap={2}>
      {onClick && (
        <Tooltip label={`Recall ${label}`}>
          <IconButton
            aria-label={t('accessibility.useThisParameter')}
            icon={<IoArrowUndoCircleOutline />}
            size="xs"
            variant="ghost"
            fontSize={20}
            onClick={onClick}
          />
        </Tooltip>
      )}
      {withCopy && (
        <Tooltip label={`Copy ${label}`}>
          <IconButton
            aria-label={`Copy ${label}`}
            icon={<FaCopy />}
            size="xs"
            variant="ghost"
            fontSize={14}
            onClick={() => navigator.clipboard.writeText(value.toString())}
          />
        </Tooltip>
      )}
      <Flex direction={labelPosition ? 'column' : 'row'}>
        <Text fontWeight="semibold" whiteSpace="pre-wrap" pr={2}>
          {label}:
        </Text>
        {isLink ? (
          <Link href={value.toString()} isExternal wordBreak="break-all">
            {value.toString()} <ExternalLinkIcon mx="2px" />
          </Link>
        ) : (
          <Text overflowY="scroll" wordBreak="break-all">
            {value.toString()}
          </Text>
        )}
      </Flex>
    </Flex>
  );
};

type ImageMetadataViewerProps = {
  image: ImageDTO;
};

// TODO: I don't know if this is needed.
const memoEqualityCheck = (
  prev: ImageMetadataViewerProps,
  next: ImageMetadataViewerProps
) => prev.image.image_name === next.image.image_name;

// TODO: Show more interesting information in this component.

/**
 * Image metadata viewer overlays currently selected image and provides
 * access to any of its metadata for use in processing.
 */
const ImageMetadataViewer = memo(({ image }: ImageMetadataViewerProps) => {
  const dispatch = useAppDispatch();

  const setBothPrompts = useSetBothPrompts();

  useHotkeys('esc', () => {
    dispatch(setShouldShowImageDetails(false));
  });

  const sessionId = image?.session_id;

  const metadata = image?.metadata;

  const { t } = useTranslation();
  const { getUrl } = useGetUrl();

  const metadataJSON = JSON.stringify(image, null, 2);

  return (
    <Flex
      sx={{
        padding: 4,
        gap: 1,
        flexDirection: 'column',
        width: 'full',
        height: 'full',
        backdropFilter: 'blur(20px)',
        bg: 'whiteAlpha.600',
        _dark: {
          bg: 'blackAlpha.600',
        },
        overflow: 'scroll',
      }}
    >
      <Flex gap={2}>
        <Text fontWeight="semibold">File:</Text>
        <Link
          href={getUrl(image.image_url)}
          isExternal
          maxW="calc(100% - 3rem)"
        >
          {image.image_name}
          <ExternalLinkIcon mx="2px" />
        </Link>
      </Flex>
      {metadata && Object.keys(metadata).length > 0 ? (
        <>
          {metadata.type && (
            <MetadataItem label="Invocation type" value={metadata.type} />
          )}
          {metadata.width && (
            <MetadataItem
              label="Width"
              value={metadata.width}
              onClick={() => dispatch(setWidth(Number(metadata.width)))}
            />
          )}
          {metadata.height && (
            <MetadataItem
              label="Height"
              value={metadata.height}
              onClick={() => dispatch(setHeight(Number(metadata.height)))}
            />
          )}
          {metadata.model && (
            <MetadataItem label="Model" value={metadata.model} />
          )}
          {metadata.positive_conditioning && (
            <MetadataItem
              label="Prompt"
              labelPosition="top"
              value={
                typeof metadata.positive_conditioning === 'string'
                  ? metadata.positive_conditioning
                  : promptToString(metadata.positive_conditioning)
              }
              onClick={() => setPositivePrompt(metadata.positive_conditioning!)}
            />
          )}
          {metadata.negative_conditioning && (
            <MetadataItem
              label="Prompt"
              labelPosition="top"
              value={
                typeof metadata.negative_conditioning === 'string'
                  ? metadata.negative_conditioning
                  : promptToString(metadata.negative_conditioning)
              }
              onClick={() => setNegativePrompt(metadata.negative_conditioning!)}
            />
          )}
          {metadata.seed !== undefined && (
            <MetadataItem
              label="Seed"
              value={metadata.seed}
              onClick={() => dispatch(setSeed(Number(metadata.seed)))}
            />
          )}
          {/* {metadata.threshold !== undefined && (
            <MetadataItem
              label="Noise Threshold"
              value={metadata.threshold}
              onClick={() => dispatch(setThreshold(Number(metadata.threshold)))}
            />
          )}
          {metadata.perlin !== undefined && (
            <MetadataItem
              label="Perlin Noise"
              value={metadata.perlin}
              onClick={() => dispatch(setPerlin(Number(metadata.perlin)))}
            />
          )} */}
          {metadata.scheduler && (
            <MetadataItem
              label="Scheduler"
              value={metadata.scheduler}
              onClick={() =>
                dispatch(setScheduler(metadata.scheduler as Scheduler))
              }
            />
          )}
          {metadata.steps && (
            <MetadataItem
              label="Steps"
              value={metadata.steps}
              onClick={() => dispatch(setSteps(Number(metadata.steps)))}
            />
          )}
          {metadata.cfg_scale !== undefined && (
            <MetadataItem
              label="CFG scale"
              value={metadata.cfg_scale}
              onClick={() => dispatch(setCfgScale(Number(metadata.cfg_scale)))}
            />
          )}
          {/* {metadata.variations && metadata.variations.length > 0 && (
            <MetadataItem
              label="Seed-weight pairs"
              value={seedWeightsToString(metadata.variations)}
              onClick={() =>
                dispatch(
                  setSeedWeights(seedWeightsToString(metadata.variations))
                )
              }
            />
          )}
          {metadata.seamless && (
            <MetadataItem
              label="Seamless"
              value={metadata.seamless}
              onClick={() => dispatch(setSeamless(metadata.seamless))}
            />
          )}
          {metadata.hires_fix && (
            <MetadataItem
              label="High Resolution Optimization"
              value={metadata.hires_fix}
              onClick={() => dispatch(setHiresFix(metadata.hires_fix))}
            />
          )} */}

          {/* {init_image_path && (
            <MetadataItem
              label="Initial image"
              value={init_image_path}
              isLink
              onClick={() => dispatch(setInitialImage(init_image_path))}
            />
          )} */}
          {metadata.strength && (
            <MetadataItem
              label="Image to image strength"
              value={metadata.strength}
              onClick={() =>
                dispatch(setImg2imgStrength(Number(metadata.strength)))
              }
            />
          )}
          {/* {metadata.fit && (
            <MetadataItem
              label="Image to image fit"
              value={metadata.fit}
              onClick={() => dispatch(setShouldFitToWidthHeight(metadata.fit))}
            />
          )} */}
        </>
      ) : (
        <Center width="100%" pt={10}>
          <Text fontSize="lg" fontWeight="semibold">
            No metadata available
          </Text>
        </Center>
      )}
      <Flex gap={2} direction="column" overflow="auto">
        <Flex gap={2}>
          <Tooltip label="Copy metadata JSON">
            <IconButton
              aria-label={t('accessibility.copyMetadataJson')}
              icon={<FaCopy />}
              size="xs"
              variant="ghost"
              fontSize={14}
              onClick={() => navigator.clipboard.writeText(metadataJSON)}
            />
          </Tooltip>
          <Text fontWeight="semibold">Metadata JSON:</Text>
        </Flex>
        <OverlayScrollbarsComponent defer>
          <Box
            sx={{
              padding: 4,
              borderRadius: 'base',
              bg: 'whiteAlpha.500',
              _dark: { bg: 'blackAlpha.500' },
              w: 'max-content',
            }}
          >
            <pre>{metadataJSON}</pre>
          </Box>
        </OverlayScrollbarsComponent>
      </Flex>
    </Flex>
  );
}, memoEqualityCheck);

ImageMetadataViewer.displayName = 'ImageMetadataViewer';

export default ImageMetadataViewer;
