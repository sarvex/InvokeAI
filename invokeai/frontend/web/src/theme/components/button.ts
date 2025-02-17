import { defineStyle, defineStyleConfig } from '@chakra-ui/react';
import { mode } from '@chakra-ui/theme-tools';

const invokeAI = defineStyle((props) => {
  const { colorScheme: c } = props;
  // must specify `_disabled` colors if we override `_hover`, else hover on disabled has no styles

  if (c === 'base') {
    const _disabled = {
      bg: mode('base.150', 'base.700')(props),
      color: mode('base.500', 'base.500')(props),
      svg: {
        fill: mode('base.500', 'base.500')(props),
      },
      opacity: 1,
    };

    return {
      bg: mode('base.200', 'base.600')(props),
      color: mode('base.850', 'base.100')(props),
      borderRadius: 'base',
      svg: {
        fill: mode('base.850', 'base.100')(props),
      },
      _hover: {
        bg: mode('base.300', 'base.500')(props),
        color: mode('base.900', 'base.50')(props),
        svg: {
          fill: mode('base.900', 'base.50')(props),
        },
        _disabled,
      },
      _disabled,
    };
  }

  const _disabled = {
    bg: mode(`${c}.250`, `${c}.700`)(props),
    color: mode(`${c}.50`, `${c}.500`)(props),
    svg: {
      fill: mode(`${c}.50`, `${c}.500`)(props),
      filter: 'unset',
    },
    opacity: 1,
    filter: mode(undefined, 'saturate(65%)')(props),
  };

  return {
    bg: mode(`${c}.400`, `${c}.600`)(props),
    color: mode(`base.50`, `base.100`)(props),
    borderRadius: 'base',
    svg: {
      fill: mode(`base.50`, `base.100`)(props),
    },
    _disabled,
    _hover: {
      bg: mode(`${c}.500`, `${c}.500`)(props),
      color: mode('white', `base.50`)(props),
      svg: {
        fill: mode('white', `base.50`)(props),
      },
      _disabled,
    },
  };
});

export const buttonTheme = defineStyleConfig({
  variants: {
    invokeAI,
  },
  defaultProps: {
    variant: 'invokeAI',
    colorScheme: 'base',
  },
});
