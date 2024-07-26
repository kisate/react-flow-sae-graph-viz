import Dagre from '@dagrejs/dagre';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceX,
  forceY,
} from 'd3-force';
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
  Handle,
  Position,

  useNodesInitialized,
  MarkerType,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';
import { collide } from './collide';

interface LayoutOptions {
  direction: 'TB' | 'LR';
}

const simulation = forceSimulation()
  .force('charge', forceManyBody().strength(-1000))
  .force('x', forceX().x(0).strength(0.05))
  .force('y', forceY().y(0).strength(0.05))
  .force('collide', collide())
  .alphaTarget(0.05)
  .stop();

type LayoutedElementsReturnType = [boolean, { toggle: () => void; isRunning: () => boolean }];

const handleOrphans = (nodes: Node[], edges: Edge[]) => {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edgeIds = new Set(edges.filter((edge) => !edge.hidden).flatMap((edge) => [edge.source, edge.target]));

  const orphanedNodes = nodes.filter((node) => !edgeIds.has(node.id));

  return nodes.map((node) => {
    if (orphanedNodes.includes(node)) {
      return { ...node, hidden: true };
    } else {
      return { ...node, hidden: false };
    }
  });
}


const useLayoutedElements = (): LayoutedElementsReturnType => {
  const { getNodes, setNodes, getEdges, fitView } = useReactFlow();
  const initialized = useNodesInitialized();

  return useMemo(() => {
    let nodes = getNodes().map((node) => ({
      ...node,
      x: node.position.x,
      y: node.position.y,
    }));
    let edges = getEdges().map((edge) => edge);
    let running = false;

    // If React Flow hasn't initialized our nodes with a width and height yet, or
    // if there are no nodes in the flow, then we can't run the simulation!
    if (!initialized || nodes.length === 0) return [false, { toggle: () => { }, isRunning: () => false }];

    simulation.nodes(nodes).force(
      'link',
      forceLink(edges)
        .id((d: any) => d.id)
        .strength(0.05)
        .distance(100),
    );

    // The tick function is called every animation frame while the simulation is
    // running and progresses the simulation one step forward each time.
    const tick = () => {
      getNodes().forEach((node, i) => {
        const dragging = Boolean(
          document.querySelector(`[data-id="${node.id}"].dragging`),
        );

        // Setting the fx/fy properties of a node tells the simulation to "fix"
        // the node at that position and ignore any forces that would normally
        // cause it to move.
        // @ts-ignore
        nodes[i].fx = dragging ? node.position.x : null;
        // @ts-ignore
        nodes[i].fy = dragging ? node.position.y : null;
      });

      simulation.tick();
      setNodes(
        nodes.map((node) => ({ ...node, position: { x: node.x, y: node.y } })),
      );

      window.requestAnimationFrame(() => {
        // Give React and React Flow a chance to update and render the new node
        // positions before we fit the viewport to the new layout.
        fitView();

        // If the simulation hasn't be stopped, schedule another tick.
        if (running) tick();
      });
    };

    const toggle = () => {
      running = !running;
      running && window.requestAnimationFrame(tick);
    };

    const isRunning = () => running;

    return [true, { toggle, isRunning }];
  }, [initialized]);
};

const ToggleNode = ({ id, data }: { id: any, data: any }) => {
  const { setNodes, setEdges } = useReactFlow();

  const toggleEdges = () => {
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.source === id) {
          return { ...edge, hidden: !edge.hidden };
        }
        return edge;
      })
    );
  };

  const featureType = data.label.split(':')[0][0];
  const colors = new Map([
    ["e", "red"],
    ["r", "green"],
    ["a", "blue"],
    ["t", "orange"],
  ]);


  return (
    <div>
      <Handle type="target" position={Position.Top} />
      <div>
        <label style={{ color: colors.get(featureType) }}>{data.label}</label>
        {/* <button onClick={toggleEdges}>Toggle Edges</button> */}
        <button onClick={() => data.expandNode(id)}>Expand Node</button>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

const nodeTypes = {
  toggleNode: ToggleNode,
};

function nodeKeysToName(keys: string[]) {
  return keys.join(':');
}

const LayoutFlow: React.FC = () => {
  const { fitView } = useReactFlow();
  const reactFlow = useReactFlow();
  const { setViewport, zoomIn, zoomOut } = useReactFlow();

  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [allEdges, setAllEdges] = useState<Edge[]>([]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(allNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(allEdges);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [centerNode, setCenterNode] = useState<string | null>(null);
  const [ieThreshold, setIeThreshold] = useState<number>(0.5);
  const [minWeight, setMinWeight] = useState<number>(0);


  const [initialized, { toggle, isRunning }] = useLayoutedElements();

  function centerOnNode() {
    if (centerNode) {
      const node = reactFlow.getNode(centerNode);
      if (node) {
        const viewport = reactFlow.getViewport();
        reactFlow.setCenter(node.position.x, node.position.y, { zoom: viewport.zoom });
      }
    }
  }

  const onLayout = useCallback(
    (direction: 'TB' | 'LR') => {
      console.log(nodes);
      // const layouted = getLayoutedElements(nodes, edges, { direction });

      // setNodes([...layouted.nodes]);
      // setEdges([...layouted.edges]);

      // window.requestAnimationFrame(() => {
      //   fitView();
      //   centerOnNode();
      // });
    },
    [nodes, edges, fitView, setNodes, setEdges]
  );

  const expandNode = (node: string) => {
    console.log(node);
    const nodesToActivate = new Set<string>();
    setAllEdges((edges) => {
      const newEdges = edges.map((e) => {
        if (e.source === node || e.target === node) {
          nodesToActivate.add(e.source);
          nodesToActivate.add(e.target);
          return { ...e, hidden: false };
        } else {
          return { ...e };
        }
      })
      setEdges(newEdges.filter((edge) => !edge.hidden));
      return newEdges;
    });

    setAllNodes((nodes) => {
      const newNodes = nodes.map((n) => {
        if (nodesToActivate.has(n.id)) {
          return { ...n, hidden: false };
        } else {
          return { ...n };
        }
      });
      setNodes(newNodes.filter((node) => !node.hidden));
      return newNodes;
    });
    setCenterNode(node);
  }

  const handleSubmit = (event: any) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const file = data.get('file') as File;

    if (file) {
      const reader = new FileReader();
      reader.onload = (event: any) => {
        const content = event.target.result;
        const graph = JSON.parse(content);

        console.log(graph);


        const maxWeight = Math.max(...graph.map((edge: any) => edge[0]));

        let newEdges = graph.map((edge: any) => {
          const source = nodeKeysToName(edge[1]);
          const target = nodeKeysToName(edge[2]);

          return {
            id: source + "-" + target, source: source, target: target,
            animated: false, hidden: true,
            data: { weight: edge[0] },
            // style: {strokeWidth: 3 * (Math.log(edge[0]) - Math.log(minWeight)) / (Math.log(maxWeight) - Math.log(minWeight))} }
            style: { strokeWidth: 3 },
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
            data: { label: node, expandNode: expandNode, },
            hidden: true,
            position: { x: layerNodeCounter.get(layer)! * 100, y: layer * 400 },
          };

          layerNodeCounter.set(layer, layerNodeCounter.get(layer)! + 1);

          return nodeData
        });

        const threshold = graph[4 * newNodes.length][0];

        newEdges = newEdges.map((edge: any) => {
          return {
            ...edge,
            style: { strokeWidth: 10 * (Math.log(edge.data.weight) - Math.log(threshold)) / (Math.log(maxWeight) - Math.log(threshold)) }
          }
        });

        setAllNodes(newNodes);
        setAllEdges(newEdges);

        setNodes(newNodes.filter((node) => !node.hidden).map((node) => {
          const existingNode = reactFlow.getNode(node.id);
          if (existingNode) {
            return existingNode;
          }
          return node;
        }));
        setEdges(newEdges.filter((edge: any) => !edge.hidden));

        expandNode(newNodes[0]!.id);
        setIeThreshold(threshold);
        setMinWeight(threshold);
      };
      reader.readAsText(file);
    }
  }

  const handleNodeSelect = (event: any) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const node = data.get('text') as string | null;
    setSelectedNode(node);


    if (node) {
      expandNode(node);
    }

  }

  useEffect(() => {
    centerOnNode();
  }, [centerNode]);

  useEffect(() => {
    setEdges((edges) => {
      const newEdges = edges.map((edge: any) => {
        if (edge.data.weight < ieThreshold) {
          return { ...edge, hidden: true };
        } else {
          return { ...edge, hidden: false };
        }
      });

      setNodes((nodes) => {
        return handleOrphans(nodes, newEdges);
      });
      return newEdges;
    });
  }, [ieThreshold]);

  // useLayoutEffect(() => {
  //   if (centerNode) {
  //     const node = reactFlow.getNode(centerNode);
  //     if (node) {
  //       reactFlow.setCenter(node.position.x, node.position.y);
  //     }
  //   }
  // } , [centerNode]);

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
        <button onClick={() => onLayout('TB')}>vertical layout</button>
        <button onClick={() => onLayout('LR')}>horizontal layout</button>
        <form onSubmit={handleSubmit}>
          <input type="file" name="file" accept=".json" />
          <button type="submit">Load Graph</button>
        </form>
        <form onSubmit={handleNodeSelect}>
          <input type="text" name="text" />
          <button type="submit">Show Node</button>
        </form>
        {initialized && <button onClick={toggle}>
          {isRunning() ? 'Stop' : 'Start'} force simulation
        </button>}
        <form>
          <input type="number" value={ieThreshold} onChange={(event) => setIeThreshold(parseFloat(event.target.value))} step="0.0000001" />
        </form>
      </Panel>
    </ReactFlow>
  );
};

const App: React.FC = () => {
  return (
    <div style={{ height: 1080 }}>
      <ReactFlowProvider>
        <LayoutFlow />
      </ReactFlowProvider>
    </div>);
};

export default App;
