import { useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { TriggerNode } from './nodes/TriggerNode';
import { ActionNode } from './nodes/ActionNode';
import { ConditionNode } from './nodes/ConditionNode';
import { NodeConfigPanel } from './NodeConfigPanel';
import { ACTION_TYPES, CONDITION_TYPES } from './types';
import { Plus, GitBranch } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
};

interface Props {
  initialNodes: Node[];
  initialEdges: Edge[];
  onChange: (nodes: Node[], edges: Edge[]) => void;
}

export function WorkflowEditor({ initialNodes, initialEdges, onChange }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Sync nodes from parent (e.g. when trigger type changes in header)
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const onConnect = useCallback((connection: Connection) => {
    const newEdge = {
      ...connection,
      id: `e-${connection.source}-${connection.target}-${Date.now()}`,
      label: connection.sourceHandle === 'yes' ? 'Sí' : connection.sourceHandle === 'no' ? 'No' : undefined,
    };
    setEdges((eds: any) => {
      const updated = addEdge(newEdge, eds);
      onChange(nodes, updated as any);
      return updated;
    });
  }, [nodes, onChange, setEdges]);

  const handleNodesChange = useCallback((changes: any) => {
    // Prevent deletion of trigger nodes via keyboard
    const filtered = changes.filter((c: any) => {
      if (c.type === 'remove') {
        const node = nodes.find(n => n.id === c.id);
        if (node?.type === 'trigger') return false;
      }
      return true;
    });
    onNodesChange(filtered);
  }, [onNodesChange, nodes]);

  const handleNodeDragStop = useCallback(() => {
    setNodes(nds => {
      onChange(nds, edges);
      return nds;
    });
  }, [edges, onChange, setNodes]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const addNode = useCallback((type: 'action' | 'condition', nodeType: string) => {
    const info = type === 'action'
      ? ACTION_TYPES.find(a => a.value === nodeType)
      : CONDITION_TYPES.find(c => c.value === nodeType);

    const lastNode = nodes[nodes.length - 1];
    const y = lastNode ? lastNode.position.y + 120 : 200;

    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: 250, y },
      data: {
        label: info?.label || nodeType,
        nodeType,
        config: {},
      },
    };

    setNodes(nds => {
      const updated = [...nds, newNode];
      onChange(updated, edges);
      return updated;
    });
  }, [nodes, edges, onChange, setNodes]);

  const updateNodeData = useCallback((id: string, data: any) => {
    setNodes(nds => {
      const updated = nds.map(n => n.id === id ? { ...n, data } : n);
      onChange(updated, edges);
      return updated;
    });
    setSelectedNode(prev => prev?.id === id ? { ...prev, data } : prev);
  }, [edges, onChange, setNodes]);

  const deleteNode = useCallback((id: string) => {
    // Never delete trigger nodes
    const node = nodes.find(n => n.id === id);
    if (node?.type === 'trigger') return;

    setNodes(nds => {
      const updated = nds.filter(n => n.id !== id);
      const updatedEdges = edges.filter(e => e.source !== id && e.target !== id);
      setEdges(updatedEdges);
      onChange(updated, updatedEdges);
      return updated;
    });
    setSelectedNode(null);
  }, [edges, onChange, setNodes, setEdges, nodes]);

  return (
    <div className="flex h-full">
      <div className="flex-1 h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onNodeDragStop={handleNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode="Delete"
        >
          <Background />
          <Controls />
          <Panel position="top-left" className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />Acción</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Agregar acción</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ACTION_TYPES.map(a => (
                  <DropdownMenuItem key={a.value} onClick={() => addNode('action', a.value)}>
                    <span className="mr-2">{a.icon}</span>{a.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline"><GitBranch className="h-4 w-4 mr-1" />Condición</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Agregar condición</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {CONDITION_TYPES.map(c => (
                  <DropdownMenuItem key={c.value} onClick={() => addNode('condition', c.value)}>
                    {c.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </Panel>
        </ReactFlow>
      </div>
      {selectedNode && (
        <div className="w-72 border-l p-2 overflow-y-auto">
          <NodeConfigPanel node={selectedNode} onUpdate={updateNodeData} onDelete={deleteNode} />
        </div>
      )}
    </div>
  );
}
