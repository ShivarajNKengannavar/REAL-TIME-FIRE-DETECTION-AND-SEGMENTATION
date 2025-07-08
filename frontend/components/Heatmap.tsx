import { useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';
import { Box } from '@chakra-ui/react';

interface HeatmapProps {
  data: number[][];
  width?: number;
  height?: number;
}

const Heatmap = ({ data, width = 400, height = 300 }: HeatmapProps) => {
  if (!data) return null;

  return (
    <Box w="100%" h={height}>
      <Plot
        data={[
          {
            z: data,
            type: 'heatmap',
            colorscale: [
              [0, 'rgb(0,0,255)'],    // Blue for low risk
              [0.4, 'rgb(0,255,255)'], // Cyan for moderate risk
              [0.6, 'rgb(255,255,0)'], // Yellow for medium risk
              [0.8, 'rgb(255,128,0)'], // Orange for high risk
              [1, 'rgb(255,0,0)']      // Red for very high risk
            ],
            showscale: true,
            hoverongaps: false,
            hovertemplate: 'Risk Level: %{z:.2f}<extra></extra>'
          }
        ]}
        layout={{
          width: width,
          height: height,
          title: 'Fire Risk Heatmap',
          margin: { t: 50, r: 0, l: 50, b: 0 },
          xaxis: {
            title: 'X Position',
            showgrid: false
          },
          yaxis: {
            title: 'Y Position',
            showgrid: false
          }
        }}
        config={{
          responsive: true,
          displayModeBar: false
        }}
      />
    </Box>
  );
};

export default Heatmap;
