import { forEach, size } from 'lodash-es';
import {
  ImageField,
  LatentsField,
  ConditioningField,
  ControlField,
} from 'services/api';

const OBJECT_TYPESTRING = '[object Object]';
const STRING_TYPESTRING = '[object String]';
const NUMBER_TYPESTRING = '[object Number]';
const BOOLEAN_TYPESTRING = '[object Boolean]';
const ARRAY_TYPESTRING = '[object Array]';

const isObject = (obj: unknown): obj is Record<string | number, any> =>
  Object.prototype.toString.call(obj) === OBJECT_TYPESTRING;

const isString = (obj: unknown): obj is string =>
  Object.prototype.toString.call(obj) === STRING_TYPESTRING;

const isNumber = (obj: unknown): obj is number =>
  Object.prototype.toString.call(obj) === NUMBER_TYPESTRING;

const isBoolean = (obj: unknown): obj is boolean =>
  Object.prototype.toString.call(obj) === BOOLEAN_TYPESTRING;

const isArray = (obj: unknown): obj is Array<any> =>
  Object.prototype.toString.call(obj) === ARRAY_TYPESTRING;

const parseImageField = (imageField: unknown): ImageField | undefined => {
  // Must be an object
  if (!isObject(imageField)) {
    return;
  }

  // An ImageField must have both `image_name` and `image_type`
  if (!('image_name' in imageField && 'image_type' in imageField)) {
    return;
  }

  // An ImageField's `image_type` must be one of the allowed values
  if (
    !['results', 'uploads', 'intermediates'].includes(imageField.image_type)
  ) {
    return;
  }

  // An ImageField's `image_name` must be a string
  if (typeof imageField.image_name !== 'string') {
    return;
  }

  // Build a valid ImageField
  return {
    image_type: imageField.image_type,
    image_name: imageField.image_name,
  };
};

const parseLatentsField = (latentsField: unknown): LatentsField | undefined => {
  // Must be an object
  if (!isObject(latentsField)) {
    return;
  }

  // A LatentsField must have a `latents_name`
  if (!('latents_name' in latentsField)) {
    return;
  }

  // A LatentsField's `latents_name` must be a string
  if (typeof latentsField.latents_name !== 'string') {
    return;
  }

  // Build a valid LatentsField
  return {
    latents_name: latentsField.latents_name,
  };
};

const parseConditioningField = (
  conditioningField: unknown
): ConditioningField | undefined => {
  // Must be an object
  if (!isObject(conditioningField)) {
    return;
  }

  // A ConditioningField must have a `conditioning_name`
  if (!('conditioning_name' in conditioningField)) {
    return;
  }

  // A ConditioningField's `conditioning_name` must be a string
  if (typeof conditioningField.conditioning_name !== 'string') {
    return;
  }

  // Build a valid ConditioningField
  return {
    conditioning_name: conditioningField.conditioning_name,
  };
};

const parseControlField = (controlField: unknown): ControlField | undefined => {
  // Must be an object
  if (!isObject(controlField)) {
    return;
  }

  // A ControlField must have a `control`
  if (!('control' in controlField)) {
    return;
  }
  // console.log(typeof controlField.control);

  // Build a valid ControlField
  return {
    control: controlField.control,
  };
};

type NodeMetadata = {
  [key: string]:
    | string
    | number
    | boolean
    | ImageField
    | LatentsField
    | ConditioningField
    | ControlField;
};

type InvokeAIMetadata = {
  session_id?: string;
  node?: NodeMetadata;
};

export const parseNodeMetadata = (
  nodeMetadata: Record<string | number, any>
): NodeMetadata | undefined => {
  if (!isObject(nodeMetadata)) {
    return;
  }

  const parsed: NodeMetadata = {};

  forEach(nodeMetadata, (nodeItem, nodeKey) => {
    // `id` and `type` must be strings if they are present
    if (['id', 'type'].includes(nodeKey)) {
      if (isString(nodeItem)) {
        parsed[nodeKey] = nodeItem;
      }
      return;
    }

    // the only valid object types are ImageField, LatentsField, ConditioningField, ControlField
    if (isObject(nodeItem)) {
      if ('image_name' in nodeItem || 'image_type' in nodeItem) {
        const imageField = parseImageField(nodeItem);
        if (imageField) {
          parsed[nodeKey] = imageField;
        }
        return;
      }

      if ('latents_name' in nodeItem) {
        const latentsField = parseLatentsField(nodeItem);
        if (latentsField) {
          parsed[nodeKey] = latentsField;
        }
        return;
      }

      if ('conditioning_name' in nodeItem) {
        const conditioningField = parseConditioningField(nodeItem);
        if (conditioningField) {
          parsed[nodeKey] = conditioningField;
        }
        return;
      }

      if ('control' in nodeItem) {
        const controlField = parseControlField(nodeItem);
        if (controlField) {
          parsed[nodeKey] = controlField;
        }
        return;
      }
    }

    // otherwise we accept any string, number or boolean
    if (isString(nodeItem) || isNumber(nodeItem) || isBoolean(nodeItem)) {
      parsed[nodeKey] = nodeItem;
      return;
    }
  });

  if (size(parsed) === 0) {
    return;
  }

  return parsed;
};

export const parseInvokeAIMetadata = (
  metadata: Record<string | number, any> | undefined
): InvokeAIMetadata | undefined => {
  if (metadata === undefined) {
    return;
  }

  if (!isObject(metadata)) {
    return;
  }

  const parsed: InvokeAIMetadata = {};

  forEach(metadata, (item, key) => {
    if (key === 'session_id' && isString(item)) {
      parsed['session_id'] = item;
    }

    if (key === 'node' && isObject(item)) {
      const nodeMetadata = parseNodeMetadata(item);

      if (nodeMetadata) {
        parsed['node'] = nodeMetadata;
      }
    }
  });

  if (size(parsed) === 0) {
    return;
  }

  return parsed;
};
