import React, { useCallback, useEffect, useLayoutEffect, useState, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Node,
  Edge,
  MarkerType,
} from '@xyflow/react';

import { getLayoutedElements } from './layout';

import '@xyflow/react/dist/style.css';

import './App.css';
import { ToggleNode } from './Node';

interface VirualNode {
  id: string;
  hidden: boolean;
  data: any;
}

interface VirtualEdge {
  id: string;
  source: string;
  target: string;
  hidden: boolean;
  underThreshold: boolean;
  data: any;
  style: any;
}


const handleOrphans = (nodes: VirualNode[], edges: VirtualEdge[]) => {
  // @ts-ignore
  const edgeIds = new Set(edges.filter((edge) => !edge.hidden && !edge.underThreshold).flatMap((edge) => [edge.source, edge.target]));

  const orphanedNodes = nodes.filter((node) => !edgeIds.has(node.id));

  return nodes.map((node) => {
    if (orphanedNodes.includes(node)) {
      return { ...node, hidden: true };
    } else {
      return { ...node, hidden: false };
    }
  });
}

function partiallyLayout(newFlowNodes: Node[], newFlowEdges: Edge[], centerNode: Node, oldNodes: Node[]) {
  const oldNodeIds = new Set(oldNodes.map((node) => node.id));
  const addedNodes = newFlowNodes.filter((node) => !oldNodeIds.has(node.id));

  addedNodes.push(centerNode);

  const addedNodeIds = new Set(addedNodes.map((node) => node.id));

  if (addedNodeIds.size === 1) {
    return oldNodes;
  }


  let updatedNodes = getLayoutedElements(newFlowNodes, newFlowEdges).nodes;

  const deltaX = centerNode.position.x - updatedNodes.find((n) => n.id === centerNode.id)!.position.x;
  const deltaY = centerNode.position.y - updatedNodes.find((n) => n.id === centerNode.id)!.position.y;

  const updatedNodesMap = new Map(updatedNodes.filter((node) => addedNodeIds.has(node.id)).map((node) => [node.id, node]));

  console.log("updatedNodes", updatedNodesMap);

  const finalNewFlowNodes = newFlowNodes.map((node) => {
    const updatedNode = updatedNodesMap.get(node.id);
    if (updatedNode) {
      return { ...node, position: { x: updatedNode.position.x + deltaX, y: updatedNode.position.y + deltaY } };
    } else {
      return node;
    }
  } );

  console.log("finalNewFlowNodes", finalNewFlowNodes);

  return finalNewFlowNodes
}


const nodeTypes = {
  toggleNode: ToggleNode,
};

function nodeKeysToName(keys: string[]) {
  return keys.join(':');
}

const LayoutFlow: React.FC = () => {
  const { fitView } = useReactFlow();
  const reactFlow = useReactFlow();

  const [virtualNodes, setVirtualNodes] = useState<VirualNode[]>([]);
  const [virtualEdges, setVirtualEdges] = useState<VirtualEdge[]>([]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [centerNode, setCenterNode] = useState<string | null>(null);
  const [ieThreshold, setIeThreshold] = useState<number>(0.5);
  const [layoutUpdated, setLayoutUpdated] = useState(true);
  const [centered, setCentered] = useState(true);
  const [maxWeight, setMaxWeight] = useState(0);
  const [nodeIEs, setNodeIEs] = useState(new Map<string, number>());

  function centerOnNode() {
    if (centerNode) {
      const node = nodes.find((node) => node.id === centerNode);
      if (node) {
        const viewport = reactFlow.getViewport();
        console.log(node);
        reactFlow.setCenter(node.position.x, node.position.y, { zoom: viewport.zoom });
      }
    }
  }

  const onLayout = useCallback(
    () => {
      console.log(nodes);
      const layouted = getLayoutedElements(nodes, edges);

      setNodes([...layouted.nodes]);
      setEdges([...layouted.edges]);

      window.requestAnimationFrame(() => {
        fitView();
      });
    },
    [nodes, edges, fitView, setNodes, setEdges]
  );

  const expandNode = (node: string, mode: string = "all") => {
    console.log(node, mode);
    setVirtualEdges((edges) => {
      const newEdges = edges.map((e) => {

        if (mode == "all") {
          if (e.source === node || e.target === node) {
            return { ...e, hidden: false };
          }
        } else if (mode == "downstream") {
          if (e.source === node) {
            return { ...e, hidden: false };
          }
        } else if (mode == "upstream") {
          if (e.target === node) {
            return { ...e, hidden: false };
          }
        }
        return e;
      });

      // @ts-ignore
      let newFlowEdges = newEdges.filter((edge) => !edge.hidden && !edge.underThreshold);
      
      setEdges(newFlowEdges);

      setVirtualNodes((nodes) => {
        let newVirtualNodes = handleOrphans(nodes, newEdges);
        const newFlowNodes = newVirtualNodes.filter((node) => !node.hidden).map((node) => {
          const existingNode = reactFlow.getNode(node.id);
          if (existingNode) {
            return existingNode;
          }
          return { ...node, position: { x: 0, y: 0 } };
        })

        setNodes((oldNodes) => {

          const expandedNode = newFlowNodes.find((n) => n.id === node)!;

          const finalNewFlowNodes = partiallyLayout(newFlowNodes, newFlowEdges, expandedNode, oldNodes);

          return finalNewFlowNodes
        });
        // setLayoutUpdated(false);
        return newVirtualNodes;
      });

      return newEdges;
    });

    setCenterNode(node);
    // setCentered(false);
  }

  const handleSubmit = (event: any) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const file = data.get('file') as File;

    if (file) {
      const reader = new FileReader();
      reader.onload = (event: any) => {
        const content = event.target.result;
        const parsedJSON = JSON.parse(content);

        const graph = parsedJSON.edges;
        const newNodeIEs = new Map<string, number>(parsedJSON.nodes.map((entry: any) => {
          const nodeId = nodeKeysToName(entry.slice(0, 4));
          const ie = entry[4];
          return [nodeId, ie];
        }));

        setNodeIEs(newNodeIEs);

        console.log(graph);


        const maxWeight = Math.max(...graph.map((edge: any) => edge[0]));

        let newEdges = graph.map((edge: any) => {
          const source = nodeKeysToName(edge[1]);
          const target = nodeKeysToName(edge[2]);

          return {
            id: source + "-" + target, source: source, target: target,
            animated: false, hidden: true,
            underThreshold: false,
            data: { weight: edge[0] },
            style: { strokeWidth: 3 },
            type: 'smoothstep',
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
          }
        });


        const allNewNodes = [...new Set(newEdges.flatMap((edge: any) => [edge.source, edge.target]))];

        //for each layer calculate the amount of nodes on it
        const layers = new Map<number, number>();
        allNewNodes.forEach((node: any) => {
          const layer = node.split(':')[1];
          layers.set(layer, (layers.get(layer) || 0) + 1);
        });

        const allLayers = Array.from(layers.keys());
        const layerNodeCounter = new Map(
          allLayers.map((layer: any) => {
            return [layer, 0];
          })
        );

        const newNodes = allNewNodes.map((node: any) => {
          const layer = node.split(':')[1];
          const nodeData = {
            id: node,
            type: 'toggleNode',
            data: { label: node, expandNode: expandNode, ie: newNodeIEs.get(node) || 0 },
            hidden: true,
            position: { x: 0, y: 0 },
          };

          layerNodeCounter.set(layer, layerNodeCounter.get(layer)! + 1);

          return nodeData
        });

        console.log(newNodes);


        console.log(graph);
        const threshold = graph[2 * newNodes.length][0];

        newEdges = newEdges.map((edge: any) => {
          return {
            ...edge,
            style: { strokeWidth: 10 * (Math.log(edge.data.weight) - Math.log(threshold)) / (Math.log(maxWeight) - Math.log(threshold)) }
          }
        });

        setVirtualNodes(newNodes);
        setVirtualEdges(newEdges);

        setNodes(newNodes.filter((node) => !node.hidden).map((node) => {
          const existingNode = reactFlow.getNode(node.id);
          if (existingNode) {
            return existingNode;
          }
          return node;
        }));
        setEdges(newEdges.filter((edge: any) => !edge.hidden));

        setIeThreshold(threshold);
        setMaxWeight(maxWeight);

        const firstNode = parsedJSON.nodes.find((entry: any) => entry[0][0] != "e");

        console.log(firstNode);

        expandNode(nodeKeysToName(firstNode.slice(0, 4)));
      };
      reader.readAsText(file);
    }
  }

  const handleNodeSelect = (event: any) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const node = data.get('text') as string | null;
    if (node) {
      expandNode(node);
    }
  }

  const handleSearchNode = (event: any) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const node = data.get('text') as string | null;
    const foundNode = nodes.find((n) => n.id === node);
    console.log(foundNode);
    if (foundNode) {
      setCenterNode(node);
      setCentered(false);
    }
  }
  
  useEffect(() => {
    setVirtualEdges((edges) => {
      const newEdges = edges.map((edge: any) => {
        return { 
          ...edge, 
          underThreshold: edge.data.weight < ieThreshold,
          style: { strokeWidth: 10 * (Math.log(edge.data.weight) - Math.log(ieThreshold)) / (Math.log(maxWeight) - Math.log(ieThreshold)) }
        };
      }); 

      let newFlowEdges = newEdges.filter((edge) => !edge.hidden && !edge.underThreshold);

      setEdges(newFlowEdges);

      setVirtualNodes((nodes) => {
        const newNodes = handleOrphans(nodes, newEdges);

        setNodes((oldNodes) => {
          const newFlowNodes =newNodes.filter((node) => !node.hidden).map((node) => {
            const existingNode = reactFlow.getNode(node.id);
            if (existingNode) {
              return existingNode;
            }
            return { ...node, position: { x: 0, y: 0 } };
          })

          return newFlowNodes
        } );
          return newNodes;
      });
      // setLayoutUpdated(false);
      // setShouldCenter(false);
      return newEdges;
    });
  }, [ieThreshold]);

  useEffect(() => {
    if (!layoutUpdated) {
      onLayout();
      // centerOnNode();
      setLayoutUpdated(true);
      setCentered(false);
    }
  } , [nodes, layoutUpdated]);

  useEffect(() => {
    if (!centered) {
      centerOnNode();
      setCentered(true);
    }
  }, [nodes, centered]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
      nodeTypes={nodeTypes}
    >
      <Panel position="top-right">
        <button onClick={() => {
          setLayoutUpdated(false);
          }}>layout</button>
        <form onSubmit={handleSubmit}>
          <input type="file" name="file" accept=".json" />
          <button type="submit">Load Graph</button>
        </form>
        <form onSubmit={handleNodeSelect}>
          <input type="text" name="text" />
          <button type="submit">Show Node</button>
        </form>
        <form>
          <input type="number" value={ieThreshold} onChange={(event) => setIeThreshold(parseFloat(event.target.value))} step="0.0000001" />
        </form>
        <button onClick={centerOnNode}>Center on Node</button>
        <form onSubmit={handleSearchNode}>
          <input type="text" name="text" />
          <button type="submit">Search Node</button>
        </form>
      </Panel>
    </ReactFlow>
  );
};

const App: React.FC = () => {
  return (
    <div style={{ height: "100vh" }}>
      <ReactFlowProvider>
        <LayoutFlow />
      </ReactFlowProvider>
    </div>);
};

export default App;
