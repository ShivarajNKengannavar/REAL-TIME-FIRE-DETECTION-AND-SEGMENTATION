import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Button,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Text,
  Input,
  RadioGroup,
  Stack,
  Radio,
} from '@chakra-ui/react';

interface Vehicle {
  id: string;
  type: string;
  status: 'available' | 'dispatched' | 'maintenance';
  lastUpdate: string;
  dispatchedTo?: string;
  dispatchedAt?: string;
  arrived?: boolean | null;
}

interface VehicleDispatchProps {
  incidentLocation?: {
    lat: number;
    lon: number;
    address: string;
  };
}

const VehicleDispatch = ({ incidentLocation }: VehicleDispatchProps) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleQuantities, setVehicleQuantities] = useState<{ [key: string]: number }>({
    'Fire Truck': 0,
    'Ambulance': 0,
  });
  const [confirmVehicles, setConfirmVehicles] = useState<Vehicle[]>([]);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  useEffect(() => {
    const mockVehicles: Vehicle[] = Array.from({ length: 10 }, (_, i) => ({
      id: `V-${(i + 1).toString().padStart(3, '0')}`,
      type: i % 2 === 0 ? 'Fire Truck' : 'Ambulance',
      status: 'available',
      lastUpdate: new Date().toISOString(),
      arrived: null,
    }));
    setVehicles(mockVehicles);

    const interval = setInterval(() => setVehicles((v) => [...v]), 60000); // re-render to update time display
    return () => clearInterval(interval);
  }, []);

  const handleQuantityChange = (type: string, value: number) => {
    setVehicleQuantities((prev) => ({
      ...prev,
      [type]: value,
    }));
  };

  const handleDispatch = () => {
    const vehiclesToDispatch: Vehicle[] = [];
    Object.entries(vehicleQuantities).forEach(([type, quantity]) => {
      if (quantity > 0) {
        const availableVehicles = vehicles.filter(
          (v) => v.type === type && v.status === 'available'
        );
        vehiclesToDispatch.push(...availableVehicles.slice(0, quantity));
      }
    });

    if (vehiclesToDispatch.length === 0) {
      toast({
        title: 'No Vehicles Available',
        description: 'Please select a quantity for at least one vehicle type.',
        status: 'warning',
        duration: 4000,
      });
      return;
    }

    setConfirmVehicles(vehiclesToDispatch);
    onOpen();
  };

  const confirmDispatch = () => {
    const now = new Date().toISOString();
    const updatedVehicles = vehicles.map((v) =>
      confirmVehicles.some((cv) => cv.id === v.id)
        ? {
            ...v,
            status: "dispatched" as const,
            dispatchedTo: incidentLocation?.address || 'Unknown',
            dispatchedAt: now,
            arrived: null,
            lastUpdate: now,
          }
        : v
    );

    setVehicles(updatedVehicles as Vehicle[]);
    setVehicleQuantities({ 'Fire Truck': 0, 'Ambulance': 0 });
    setConfirmVehicles([]);
    onClose();
    toast({
      title: 'Vehicles Dispatched',
      description: `${confirmVehicles.length} vehicle(s) dispatched.`,
      status: 'success',
      duration: 5000,
    });
  };

  const handleRecall = (vehicleId: string) => {
    const updatedVehicles = vehicles.map((v) =>
      v.id === vehicleId
        ? {
            ...v,
            status: 'available',
            dispatchedTo: undefined,
            dispatchedAt: undefined,
            arrived: null,
            lastUpdate: new Date().toISOString(),
          }
        : v
    );
    setVehicles(updatedVehicles as Vehicle[]);
    toast({
      title: 'Vehicle Recalled',
      description: `Vehicle ${vehicleId} is now available.`,
      status: 'info',
      duration: 4000,
    });
  };

  const handleArrivalStatus = (vehicleId: string, arrived: boolean) => {
    setVehicles((prev) =>
      prev.map((v) => (v.id === vehicleId ? { ...v, arrived } : v))
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'green';
      case 'dispatched':
        return 'orange';
      case 'maintenance':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getTimeAgo = (timestamp?: string) => {
    if (!timestamp) return '—';
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diffMs / 60000);
    return mins === 0 ? 'Just now' : `${mins} minute(s) ago`;
  };

  return (
    <Box borderWidth={1} borderRadius="lg" p={4}>
      <VStack spacing={6} align="stretch">
        <Heading size="md">Emergency Vehicles</Heading>

        {/* Vehicle Quantity Selection */}
        <VStack align="start" spacing={3}>
          <Text>Select Vehicle Quantities</Text>
          {['Fire Truck', 'Ambulance'].map((type) => (
            <Box key={type} display="flex" alignItems="center">
              <Text>{type}:</Text>
              <Input
                type="number"
                value={vehicleQuantities[type]}
                onChange={(e) => handleQuantityChange(type, parseInt(e.target.value) || 0)}
                min={0}
                max={vehicles.filter((v) => v.type === type && v.status === 'available').length}
                ml={2}
                width="60px"
              />
            </Box>
          ))}
        </VStack>

        <Button
          colorScheme="blue"
          size="sm"
          alignSelf="flex-start"
          onClick={handleDispatch}
          isDisabled={Object.values(vehicleQuantities).every((v) => v === 0)}
        >
          Dispatch Selected Vehicles
        </Button>

        {/* All Vehicles Table */}
        <Heading size="sm">All Vehicles</Heading>
        <Table variant="simple" size="sm">
          <Thead>
            <Tr>
              <Th>ID</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th>Dispatched To</Th>
              <Th>Action</Th>
            </Tr>
          </Thead>
          <Tbody>
            {vehicles.map((vehicle) => (
              <Tr key={vehicle.id}>
                <Td>{vehicle.id}</Td>
                <Td>{vehicle.type}</Td>
                <Td>
                  <Badge colorScheme={getStatusColor(vehicle.status)}>{vehicle.status}</Badge>
                </Td>
                <Td>
                  {vehicle.status === 'dispatched'
                    ? vehicle.dispatchedTo || 'Unknown'
                    : '—'}
                </Td>
                <Td>
                  {vehicle.status === 'dispatched' ? (
                    <Button size="sm" colorScheme="yellow" onClick={() => handleRecall(vehicle.id)}>
                      Recall
                    </Button>
                  ) : (
                    <Button size="sm" isDisabled>
                      —
                    </Button>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>

        {/* Dispatched Vehicle Details */}
        <Heading size="sm">Dispatched Vehicle Status</Heading>
        <Table variant="simple" size="sm">
          <Thead>
            <Tr>
              <Th>ID</Th>
              <Th>Type</Th>
              <Th>Dispatched To</Th>
              <Th>Time</Th>
              <Th>Reached?</Th>
            </Tr>
          </Thead>
          <Tbody>
            {vehicles
              .filter((v) => v.status === 'dispatched')
              .map((v) => (
                <Tr key={v.id}>
                  <Td>{v.id}</Td>
                  <Td>{v.type}</Td>
                  <Td>{v.dispatchedTo || 'Unknown'}</Td>
                  <Td>{getTimeAgo(v.dispatchedAt)}</Td>
                  <Td>
                    <RadioGroup
                      onChange={(val) => handleArrivalStatus(v.id, val === 'yes')}
                      value={v.arrived === true ? 'yes' : v.arrived === false ? 'no' : ''}
                    >
                      <Stack direction="row">
                        <Radio value="yes">Yes</Radio>
                        <Radio value="no">No</Radio>
                      </Stack>
                    </RadioGroup>
                  </Td>
                </Tr>
              ))}
          </Tbody>
        </Table>
      </VStack>

      {/* Confirm Dispatch Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Confirm Dispatch</ModalHeader>
          <ModalBody>
            <VStack align="stretch" spacing={3}>
              <Text>
                Dispatch {confirmVehicles.length} vehicle(s) to{' '}
                <strong>{incidentLocation?.address || 'Unknown Location'}</strong>?
              </Text>
              {confirmVehicles.map((v) => (
                <Text key={v.id}>
                  • {v.type} ({v.id})
                </Text>
              ))}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={confirmDispatch}>
              Confirm
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default VehicleDispatch;
