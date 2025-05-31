// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/react-vite';

import { AppBar } from './AppBar';

const meta = {
    component: AppBar,
    parameters: {
        layout: 'fullscreen',
    },
    argTypes: {
      title: {
        control: 'text',
        description: 'The main title displayed in the app bar',
      },
  },
} satisfies Meta<typeof AppBar>;

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: 'Dashboard',
  },
}

export const LongTitle: Story = {
  args: {
    title: 'Project Management System',
  },
}

export const ShortTitle: Story = {
  args: {
    title: 'Home',
  },
}

export const WithSpecialCharacters: Story = {
  args: {
    title: 'Analytics & Reports',
  },
}

export const EmptyTitle: Story = {
  args: {
    title: '',
  },
}