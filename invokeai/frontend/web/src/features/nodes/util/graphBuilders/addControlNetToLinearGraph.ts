import { RootState } from 'app/store/store';
import { getValidControlNets } from 'features/controlNet/util/getValidControlNets';
import { omit } from 'lodash-es';
import {
  CollectInvocation,
  ControlField,
  ControlNetInvocation,
  MetadataAccumulatorInvocation,
} from 'services/api/types';
import { NonNullableGraph } from '../../types/types';
import { CONTROL_NET_COLLECT, METADATA_ACCUMULATOR } from './constants';

export const addControlNetToLinearGraph = (
  state: RootState,
  graph: NonNullableGraph,
  baseNodeId: string
): void => {
  const { isEnabled: isControlNetEnabled, controlNets } = state.controlNet;

  const validControlNets = getValidControlNets(controlNets);

  const metadataAccumulator = graph.nodes[METADATA_ACCUMULATOR] as
    | MetadataAccumulatorInvocation
    | undefined;

  if (isControlNetEnabled && Boolean(validControlNets.length)) {
    if (validControlNets.length) {
      // We have multiple controlnets, add ControlNet collector
      const controlNetIterateNode: CollectInvocation = {
        id: CONTROL_NET_COLLECT,
        type: 'collect',
      };
      graph.nodes[CONTROL_NET_COLLECT] = controlNetIterateNode;
      graph.edges.push({
        source: { node_id: CONTROL_NET_COLLECT, field: 'collection' },
        destination: {
          node_id: baseNodeId,
          field: 'control',
        },
      });

      validControlNets.forEach((controlNet) => {
        const {
          controlNetId,
          controlImage,
          processedControlImage,
          beginStepPct,
          endStepPct,
          controlMode,
          model,
          processorType,
          weight,
        } = controlNet;

        const controlNetNode: ControlNetInvocation = {
          id: `control_net_${controlNetId}`,
          type: 'controlnet',
          begin_step_percent: beginStepPct,
          end_step_percent: endStepPct,
          control_mode: controlMode,
          control_model: model as ControlNetInvocation['control_model'],
          control_weight: weight,
        };

        if (processedControlImage && processorType !== 'none') {
          // We've already processed the image in the app, so we can just use the processed image
          controlNetNode.image = {
            image_name: processedControlImage,
          };
        } else if (controlImage) {
          // The control image is preprocessed
          controlNetNode.image = {
            image_name: controlImage,
          };
        } else {
          // Skip ControlNets without an unprocessed image - should never happen if everything is working correctly
          return;
        }

        graph.nodes[controlNetNode.id] = controlNetNode;

        if (metadataAccumulator) {
          // metadata accumulator only needs a control field - not the whole node
          // extract what we need and add to the accumulator
          const controlField = omit(controlNetNode, [
            'id',
            'type',
          ]) as ControlField;
          metadataAccumulator.controlnets.push(controlField);
        }

        graph.edges.push({
          source: { node_id: controlNetNode.id, field: 'control' },
          destination: {
            node_id: CONTROL_NET_COLLECT,
            field: 'item',
          },
        });
      });
    }
  }
};
