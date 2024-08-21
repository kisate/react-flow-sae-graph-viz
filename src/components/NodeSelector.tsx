interface NodeSelectorProps {
    nodeIes: Map<string, number>;
    onSelectNode: (nodeId: string) => void;
    }


export function NodeSelector({ nodeIes, onSelectNode }: NodeSelectorProps) {
    return (
        <ul> 
            {Array.from(nodeIes).slice(0, 1000).map(([nodeId, ie]) => (
                <li key={nodeId}>
                    <button onClick={() => onSelectNode(nodeId)}>
                        {nodeId}: {ie}
                    </button>
                </li>
            ))}
        </ul>
    );
}
