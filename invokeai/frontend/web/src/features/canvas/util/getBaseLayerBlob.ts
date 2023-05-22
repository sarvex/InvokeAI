import { getCanvasBaseLayer } from './konvaInstanceProvider';
import { RootState } from 'app/store/store';
import { konvaNodeToBlob } from './konvaNodeToBlob';

export const getBaseLayerBlob = async (
  state: RootState,
  withoutBoundingBox?: boolean
) => {
  const canvasBaseLayer = getCanvasBaseLayer();

  if (!canvasBaseLayer) {
    return;
  }

  const {
    shouldCropToBoundingBoxOnSave,
    boundingBoxCoordinates,
    boundingBoxDimensions,
  } = state.canvas;

  const clonedBaseLayer = canvasBaseLayer.clone();

  clonedBaseLayer.scale({ x: 1, y: 1 });

  const absPos = clonedBaseLayer.getAbsolutePosition();

  const boundingBox =
    shouldCropToBoundingBoxOnSave && !withoutBoundingBox
      ? {
          x: boundingBoxCoordinates.x + absPos.x,
          y: boundingBoxCoordinates.y + absPos.y,
          width: boundingBoxDimensions.width,
          height: boundingBoxDimensions.height,
        }
      : clonedBaseLayer.getClientRect();

  return konvaNodeToBlob(clonedBaseLayer, boundingBox);
};
