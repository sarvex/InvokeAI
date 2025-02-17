import { Tooltip } from '@chakra-ui/react';
import { Select, SelectProps } from '@mantine/core';
import { useMantineSelectStyles } from 'mantine-theme/hooks/useMantineSelectStyles';
import { RefObject, memo } from 'react';

export type IAISelectDataType = {
  value: string;
  label: string;
  tooltip?: string;
};

type IAISelectProps = SelectProps & {
  tooltip?: string;
  inputRef?: RefObject<HTMLInputElement>;
};

const IAIMantineSelect = (props: IAISelectProps) => {
  const { tooltip, inputRef, ...rest } = props;

  const styles = useMantineSelectStyles();

  return (
    <Tooltip label={tooltip} placement="top" hasArrow>
      <Select ref={inputRef} styles={styles} {...rest} />
    </Tooltip>
  );
};

export default memo(IAIMantineSelect);
