import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
  styles: {
    global: {
      body: {
        bg: 'gray.50',
      },
    },
  },
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'blue',
      },
    },
    Container: {
      baseStyle: {
        maxW: 'container.xl',
      },
    },
  },
  colors: {
    risk: {
      low: '#00ff00',
      medium: '#ffff00',
      high: '#ff8000',
      critical: '#ff0000',
    },
  },
});

export default theme;
