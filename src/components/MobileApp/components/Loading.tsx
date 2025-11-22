import React from 'react';
import { Box, CircularProgress, Typography, Container } from '@mui/material';
import { keyframes } from '@emotion/react';

interface LoadingProps {
  message?: string;
}

const pulse = keyframes`
  0% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.6;
  }
`;

const Loading: React.FC<LoadingProps> = ({ message = 'Loading...' }) => {

  return (
    <Container 
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: 'background.default',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          p: 3,
          borderRadius: 2,
          backgroundColor: 'background.paper',
          boxShadow: 3,
          maxWidth: '90%',
          width: '300px',
        }}
      >
        <CircularProgress
          size={60}
          thickness={4}
          sx={{
            color: 'primary.main',
            mb: 2,
          }}
        />
        
        <Typography 
          variant="h6" 
          sx={{ 
            textAlign: 'center',
            animation: `${pulse} 1.5s infinite ease-in-out`,
            color: 'text.primary',
            fontWeight: 'medium',
          }}
        >
          {message}
        </Typography>
        
        <Typography 
          variant="body2" 
          color="text.secondary" 
          sx={{ 
            mt: 1,
            textAlign: 'center',
          }}
        >
          Please wait while we load your content
        </Typography>
      </Box>
    </Container>
  );
};

export default Loading;
