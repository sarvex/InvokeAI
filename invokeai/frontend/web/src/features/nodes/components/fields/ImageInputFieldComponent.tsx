import { Box, Image } from '@chakra-ui/react';
import { useAppDispatch } from 'app/store/storeHooks';
import SelectImagePlaceholder from 'common/components/SelectImagePlaceholder';
import { useGetUrl } from 'common/util/getUrl';
import useGetImageByNameAndType from 'features/gallery/hooks/useGetImageByName';

import { fieldValueChanged } from 'features/nodes/store/nodesSlice';
import {
  ImageInputFieldTemplate,
  ImageInputFieldValue,
} from 'features/nodes/types/types';
import { DragEvent, memo, useCallback, useState } from 'react';

import { ImageType } from 'services/api';
import { FieldComponentProps } from './types';

const ImageInputFieldComponent = (
  props: FieldComponentProps<ImageInputFieldValue, ImageInputFieldTemplate>
) => {
  const { nodeId, field } = props;

  const getImageByNameAndType = useGetImageByNameAndType();
  const dispatch = useAppDispatch();
  const [url, setUrl] = useState<string | undefined>(field.value?.image_url);
  const { getUrl } = useGetUrl();

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      const name = e.dataTransfer.getData('invokeai/imageName');
      const type = e.dataTransfer.getData('invokeai/imageType') as ImageType;

      if (!name || !type) {
        return;
      }

      const image = getImageByNameAndType(name, type);

      if (!image) {
        return;
      }

      setUrl(image.image_url);

      dispatch(
        fieldValueChanged({
          nodeId,
          fieldName: field.name,
          value: image,
        })
      );
    },
    [getImageByNameAndType, dispatch, field.name, nodeId]
  );

  return (
    <Box onDrop={handleDrop}>
      <Image src={getUrl(url)} fallback={<SelectImagePlaceholder />} />
    </Box>
  );
};

export default memo(ImageInputFieldComponent);
