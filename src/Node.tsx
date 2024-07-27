import { Handle, Position, useReactFlow, useUpdateNodeInternals } from "@xyflow/react";
import { useState } from "react";
import build_url from "./utils";
import axios from "axios";

function calculate_selection_metric(scale_tuning: any, probe_layer: number, alpha: number, required_scale: number): number[] {
    const normalized_ce = normalize(scale_tuning.crossents);
    const scales = scale_tuning.scales;
    const self_similarity = scale_tuning.selfsims[probe_layer];
    const self_similarity_normalized = normalize(self_similarity);

    const metric = normalized_ce.map((ce: any, i: any) => self_similarity_normalized[i] * alpha - ce * (1 - alpha));
    for (let i = 0; i < metric.length; i++) {
        if (scales[i] < required_scale) {
            metric[i] = Math.min(... metric);
        }
    }
    return metric;
}


function sort_by_metric(texts: any[], scales: number[], metric: number[]): any[] {
    const scale_to_ind = scales.map((s) => Math.floor(s * metric.length));
    const sorted_texts = texts.map((t, i) => ({ text: t, ind: scale_to_ind[i] }))
        .sort((a, b) => metric[b.ind] - metric[a.ind])
        .map((t) => t.text);

    return sorted_texts;
}

function process_explanation(raw_text: string): string {
    const text = raw_text.replace(/(?:\r\n|\r|\n)/g, ' ');

    if (text.includes("<eos>")) {
        return text.split("<eos>")[0];
    }

    if (text[-1] === '"') {
        return text
    }

    return text + "...";
}

function process_selfe_explanations(max_scale: number, min_scale: number, generations: any, probe_layer: number, selection_metric: number[]): [string[], number[], number[]] {
    // Match the self-explanations with the scales and sort row.generations.texts using row.generations.scales    
    const scales = generations.scales.map ((s: number) => (s - min_scale) / (max_scale - min_scale));
    const texts = generations.texts.map ((t: string) => process_explanation(t));

    const sorted_texts = sort_by_metric(texts, scales, selection_metric);
    const sorted_scales = sort_by_metric(scales, scales, selection_metric).map((s) => s * (max_scale - min_scale) + min_scale);
    const original_idx = sort_by_metric(Array.from({length: scales.length}, (_, i) => i), scales, selection_metric);

    return [sorted_texts, sorted_scales, original_idx];
}

function normalize(values: number[]): number[] {
    const max_val = Math.max(...values);
    const min_val = Math.min(...values);
    return values.map((v) => (v - min_val) / (max_val - min_val));
}   

function handleRow(row: any) {
    const probe_layer = 16;
    const alpha = 0.4;
    const required_scale = 10;


    const max_scale = row.settings.max_scale;
    const min_scale = row.settings.min_scale;
    const generations = row.generations;

    const selection_metric = calculate_selection_metric(row.scale_tuning, probe_layer, alpha, required_scale);

    const [selfe_explanations, selfe_scales, original_idx] = process_selfe_explanations(max_scale, min_scale, generations, probe_layer, selection_metric);

    return {
        selfe_explanations: selfe_explanations,
        selfe_scales: selfe_scales,
        scales: row.scale_tuning.scales,
        self_similarity: row.scale_tuning.selfsims[16],
        entropy: row.scale_tuning.entropy,
        cross_entropy: row.scale_tuning.crossents,
        optimal_scale: 0.0,
        original_idx: original_idx,
        selection_metric: selection_metric,
    };
}

export const ToggleNode = ({ id, data }: { id: any, data: any }) => {
    const { setNodes, setEdges } = useReactFlow();
    const [explanation, setExplanation] = useState<string[] | null>(null);
    const updateNodeInternals = useUpdateNodeInternals();
  
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
  
    const loadExplanation = async () => {
      if (id.split(':')[0][0] !== 'e') {
        const url = build_url(id);
        console.log(url);
        axios.get(url).then((response) => {
            console.log(response.data.rows[0]);
            const processed = handleRow(response.data.rows[0].row);
            setExplanation(
                processed.selfe_explanations.slice(0, 3)
            )
            updateNodeInternals(id);
        }).catch((error) => {
            console.log(error);
        } );
      }
    } 
  
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
        <div className='node-insides'>
          <label style={{ color: colors.get(featureType) }}>{data.label}</label>
          {/* <button onClick={toggleEdges}>Toggle Edges</button> */}
          <button onClick={() => data.expandNode(id)}>Expand Node</button>
          <button onClick={loadExplanation}>Get Explanation</button>
          {explanation && explanation.map((exp: string, i: number) => <label key={i} style={{color: "black", fontSize: "0.8rem"}}>{exp}</label>)}
        </div>
        <Handle type="source" position={Position.Bottom} />
      </div>
    );
  };