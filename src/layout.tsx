

import { sugiyama, decrossTwoLayer, coordCenter, layeringSimplex, graphStratify } from 'd3-dag';
import { Node, Edge } from '@xyflow/react';


export const getLayoutedElements = (
    nodes: Node[],
    edges: Edge[]
  ) => {

    console.log('nodes', nodes);
    console.log('edges', edges);

    // Prepare the input for d3-dag
    const nodeParents = new Map<string, string[]>();
    edges.forEach((edge) => {
      if (!nodeParents.has(edge.target)) {
        nodeParents.set(edge.target, []);
      }
      if (!nodeParents.has(edge.source)) {
        nodeParents.set(edge.source, []);
      }
      nodeParents.get(edge.target)!.push(edge.source);
    });
  
    const dagNodes = Array.from(nodeParents.entries()).map(([id, parents]) => {
      if (parents.length === 0) {
        return { id: id };
      }
      return { id: id, parentIds: parents };
    });
  
    // Create the dag
    const stratify = graphStratify()
  
    const dag = stratify(dagNodes);
  
    // Apply Sugiyama layout
    const layout = sugiyama()
      .layering(layeringSimplex())
      .decross(decrossTwoLayer())
      .coord(coordCenter());
  
    layout(dag);
  
    const xScale = 100;
    const yScale = 150;
  
    // Extract the layout information
    const nodeMap = new Map();
    for (const node of dag.nodes()) {
      nodeMap.set(node.data.id, { x: node.x * xScale, y: node.y * yScale });
    }

    console.log('nodeMap', nodeMap);
  
    return {
      nodes: nodes.map((node) => {
        const position = nodeMap.get(node.id);
        const x = position.x - (node.measured?.width ?? 0) / 2;
        const y = position.y - (node.measured?.height ?? 0) / 2;
  
        return { ...node, position: { x, y } };
      }),
      edges,
    };
  };
  