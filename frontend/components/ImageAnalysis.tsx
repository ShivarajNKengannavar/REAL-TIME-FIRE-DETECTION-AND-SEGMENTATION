import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  VStack,
  useToast,
  Input,
  Progress,
  Text,
  Image,
} from '@chakra-ui/react';

interface ImageAnalysisProps {
  onAnalysisComplete: (result: any) => void;
}

const ImageAnalysis = ({ onAnalysisComplete }: ImageAnalysisProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const toast = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      toast({
        title: 'No image selected',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    setIsAnalyzing(true);
    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const response = await fetch('http://localhost:5000/analyze_image', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      onAnalysisComplete(result);
      
      toast({
        title: 'Analysis Complete',
        description: `Fire Risk Level: ${(result.risk_level * 100).toFixed(1)}%`,
        status: result.risk_level > 0.7 ? 'error' : 'info',
        duration: 5000,
      });
    } catch (error) {
      toast({
        title: 'Analysis Failed',
        description: 'Please try again',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <VStack spacing={4} align="stretch" w="100%">
      <Box borderWidth={1} borderRadius="lg" p={4}>
        <VStack spacing={4}>
          <Input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            hidden
            id="image-upload"
          />
          <Button as="label" htmlFor="image-upload" colorScheme="blue">
            Choose File
          </Button>
          {selectedFile && (
            <Text fontSize="sm" color="gray.600">
              Selected: {selectedFile.name}
            </Text>
          )}
          {preview && (
            <Box maxH="300px" overflow="hidden">
              <Image src={preview} alt="Preview" maxH="300px" objectFit="contain" />
            </Box>
          )}
          <Button
            onClick={handleAnalyze}
            isLoading={isAnalyzing}
            colorScheme="green"
            isDisabled={!selectedFile}
          >
            Analyze
          </Button>
          {isAnalyzing && <Progress size="xs" isIndeterminate w="100%" />}
        </VStack>
      </Box>
    </VStack>
  );
};

export default ImageAnalysis;
