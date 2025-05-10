import Button from '@mui/material/Button';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof Button> = {
  title: 'MUI/Button',
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    variant: 'contained',
    color: 'primary',
    children: 'Click Me',
  },
};

export const Outlined: Story = {
  args: {
    variant: 'outlined',
    color: 'primary',
    children: 'Click Me',
  },
};

export const Destructive: Story = {
    args: {
        variant: "contained",
        color: "error",
        children: "Delete",
    }
};