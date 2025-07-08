import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Box,
  Container,
  Grid,
  Heading,
  VStack,
  Input,
  Button,
  Textarea,
  useToast,
  Select,
  Text,
  HStack,
} from '@chakra-ui/react';
import { IoAlertCircle, IoCheckmarkCircle } from 'react-icons/io5'; // Importing icons for better visualization
import { io } from 'socket.io-client';
import ImageAnalysis from '../components/ImageAnalysis';
import VehicleDispatch from '../components/VehicleDispatch';

// Dynamically import map to avoid SSR issues
const Map = dynamic(() => import('../components/Map'), { ssr: false });

const socket = io('http://localhost:5000');

interface Incident {
  lat: number;
  lon: number;
  risk_level: number;
  timestamp: string;
  location_name: string;
  zone_type: string;
}

interface Location {
  lat: number;
  lon: number;
  address: string;
}

export default function Home() {
  const [videoFeed, setVideoFeed] = useState<string>('http://localhost:5000/video_feed');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [heatmapData, setHeatmapData] = useState<any>(null);
  const [selectedZone, setSelectedZone] = useState<string>('commercial');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [caseStatus, setCaseStatus] = useState<string>('pending'); // New state for case status
  const [situationDescription, setSituationDescription] = useState<string>(''); // New state for situation description
  const toast = useToast();

  const handleSearch = async () => {
    try {
      const response = await fetch(`http://localhost:5000/search_location?address=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data.error) {
        toast({
          title: 'Location Error',
          description: data.error,
          status: 'error',
          duration: 3000,
        });
      } else {
        setCurrentLocation(data);
      }
    } catch (error) {
      toast({
        title: 'Search Error',
        description: 'Failed to search location',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleImageAnalysis = (result: any) => {
    if (result?.risk_level > 0.5) {
      toast({
        title: 'High Risk Detected',
        description: `Fire risk level: ${(result.risk_level * 100).toFixed(1)}%`,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
    setHeatmapData(result?.heatmap_data);
  };

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to WebSocket');
    });

    socket.on('update', (data: any) => {
      if (data?.heatmap_data) {
        setHeatmapData(data.heatmap_data);
      }
      if (data?.max_risk > 0.7) {
        toast({
          title: 'High Risk Alert!',
          description: `Fire risk level: ${(data.max_risk * 100).toFixed(1)}%`,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    });

    return () => {
      socket.disconnect();
      console.log('Disconnected from WebSocket');
    };
  }, []);

  const handleZoneChange = async (zone: string) => {
    setSelectedZone(zone);
    try {
      const response = await fetch('http://localhost:5000/analyze_zone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          zone_type: zone,
          lat: 12.9716,
          lon: 77.5946,
        }),
      });
      const data = await response.json();
      if (data && data.lat && data.lon) {
        setIncidents((prev) => [...prev, data]);
      }
    } catch (error) {
      console.error('Error analyzing zone:', error);
    }
  };

  const handleSubmitCaseStudy = () => {
    if (!situationDescription) {
      toast({
        title: 'Error',
        description: 'Please provide a description of the situation.',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    // Here, you can send the situation description and case status for further study
    // For example, sending it to a backend API or processing it in some way.
    console.log('Case Status:', caseStatus);
    console.log('Situation Description:', situationDescription);
    toast({
      title: 'Case Submitted',
      description: 'Your case has been submitted for study.',
      status: 'success',
      duration: 3000,
    });
  };

  return (
    <Container maxW="container.xl" py={5}>
      <VStack spacing={5} align="stretch">
        <Heading as="h1" size="xl" textAlign="center" mb={6}>
          Real-Time Fire Segmentation System
        </Heading>

        {/* Location Search */}
        <Box p={4} borderWidth={1} borderRadius="lg">
          <Heading size="md" mb={4}>Location Search</Heading>
          <Input
            placeholder="Enter city, address, or landmark..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button mt={2} onClick={handleSearch}>Search</Button>
        </Box>

        <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap={6}>
          {/* Left Column */}
          <VStack spacing={4} align="stretch">
            <Box borderWidth={1} borderRadius="lg" overflow="hidden">
              <img src={videoFeed} alt="Video Feed" style={{ width: '100%' }} />
            </Box>

            <Box p={4} borderWidth={1} borderRadius="lg">
              <Heading size="md" mb={4}>Zone Analysis</Heading>
              <Select value={selectedZone} onChange={(e) => handleZoneChange(e.target.value)}>
                <option value="commercial">Commercial Zone</option>
                <option value="residential">Residential Zone</option>
                <option value="industrial">Industrial Zone</option>
              </Select>
            </Box>
          </VStack>

          {/* Right Column */}
          <VStack spacing={4} align="stretch">
            <Box h="400px" borderWidth={1} borderRadius="lg" overflow="hidden">
              <Map incidents={incidents} />
            </Box>

            <Box p={4} borderWidth={1} borderRadius="lg">
              <Heading size="md" mb={4}>Risk Analysis</Heading>
              {heatmapData ? (
                <Box id="heatmap">
                  {/* Heatmap will be rendered here */}
                  <Text>Heatmap data received and processed.</Text>
                </Box>
              ) : (
                <Text>No heatmap data yet.</Text>
              )}
            </Box>

            <Box p={4} borderWidth={1} borderRadius="lg">
              <Heading size="md" mb={4}>Upload Image for Analysis</Heading>
              <ImageAnalysis onAnalysisComplete={handleImageAnalysis} />
            </Box>

            <Box p={4} borderWidth={1} borderRadius="lg">
              <Heading size="md" mb={4}>Case Status</Heading>
              <HStack spacing={3}>
                {caseStatus === 'pending' ? (
                  <IoAlertCircle color="red" size={24} />
                ) : caseStatus === 'in_process' ? (
                  <IoCheckmarkCircle color="orange" size={24} />
                ) : (
                  <IoCheckmarkCircle color="black" size={24} />
                )}
                <Select
                  value={caseStatus}
                  onChange={(e) => setCaseStatus(e.target.value)}
                  colorScheme={caseStatus === 'pending' ? 'red' : caseStatus === 'in_process' ? 'orange' : 'green'}
                >
                  <option value="pending">Pending Inspection</option>
                  <option value="in_process">In Process</option>
                  <option value="rejected">Rejected Application</option>
                </Select>
              </HStack>
              <Text mt={2} color={caseStatus === 'pending' ? 'red.500' : caseStatus === 'in_process' ? 'orange.500' : 'green.500'}>
                {caseStatus === 'pending' ? 'Pending inspection. Awaiting review.' : 
                caseStatus === 'in_process' ? 'Inspection in process.' : 'Application rejected.'}
              </Text>
            </Box>

            {/* Situation Description */}
            <Box p={4} borderWidth={1} borderRadius="lg">
              <Heading size="md" mb={4}>Describe the Situation</Heading>
              <Textarea
                value={situationDescription}
                onChange={(e) => setSituationDescription(e.target.value)}
                placeholder="Explain the situation in detail..."
                size="md"
              />
            </Box>

            {/* Submit button for case study */}
            <Box p={4} borderWidth={1} borderRadius="lg">
              <Button colorScheme="blue" onClick={handleSubmitCaseStudy}>Submit Case for Study</Button>
            </Box>

            <VehicleDispatch incidentLocation={currentLocation ?? undefined} />
          </VStack>
        </Grid>
      </VStack>
    </Container>
  );
}
