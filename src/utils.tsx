const our_dataset = "kisate-team/gemma-2b-suite-explanations";

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

export default function build_url(nodeId: string): string {

    const split = "train";
    const offset = 0;
    const length = 1;
    const featureData = nodeId.split(':');
    const version = "our-" + featureData[0];
    const layer = featureData[1];
    const feature = featureData[3];

    const dataset = our_dataset;
    
    let config = "";
    if (version === "our-r") {
        config = 'l' + layer;
    } else if (version === "our-a") {
        config = 'l' + layer + "_attn_out";
    } else if (version === "jb-r") {
        config = 'default';
    }

    let where = null;
    if (feature !== null) {
        where = '"feature"=' + feature;
    }

    return build_hf_url(dataset, config, split, offset, length, where);
}