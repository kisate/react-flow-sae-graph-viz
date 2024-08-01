const our_dataset = "kisate-team/gemma-2b-suite-explanations";
const our_dataset_maxacts = "kisate-team/gemma-2b-suite-maxacts";

function build_hf_url(dataset: string, config: string, split: string, offset: number, length: number, where: string | null): string {
    let url = 'https://datasets-server.huggingface.co/'
    if (where !== null) {
        url += 'filter?dataset='
    }
    else {
        url += 'rows?dataset='
    }
    url += dataset + '&config=' + config + '&split=' + split + '&offset=' + offset + '&length=' + length;
    if (where !== null) {
        url += '&where=' + where;
    }
    return url;
}

export function build_url(nodeId: string, maxacts: boolean): string {

    const split = "train";
    const offset = 0;
    const length = 1;
    const featureData = nodeId.split(':');
    const version = "our-" + featureData[0];
    const layer = featureData[1];
    const feature = featureData[3];

    let dataset = our_dataset;
    if (maxacts) {
        dataset = our_dataset_maxacts;
    }
    
    if (version === "our-r") {
        dataset += "-residual";
    } else if (version === "our-a") {
        dataset += "-attn_out";
    } else if (version === "our-t") {
        dataset += "-transcoder";
    }

    let config = "l" + layer;

    let where = null;
    if (feature !== null) {
        where = '"feature"=' + feature;
    }

    return build_hf_url(dataset, config, split, offset, length, where);
}

export function build_dashboard_url(nodeId: string): string {
    const featureData = nodeId.split(':');
    let featureType = "our-" + featureData[0];
    if (featureType === "our-a") {
        featureType += "o";
    }
    const layer = featureData[1];
    const feature = featureData[3];

    const url = "https://kisate.github.io/feature-dashboard?version=" + featureType + "&layer=" + layer + "&targetFeature=" + feature;
    return url;
}