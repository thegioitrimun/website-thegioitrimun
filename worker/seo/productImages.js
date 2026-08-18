const PRODUCT_IMAGE_SELECT = 'id,product_id,image_path,is_primary,display_order';

export async function fetchProductImagesForProducts(productIds, supabaseFetch, select = PRODUCT_IMAGE_SELECT) {
    const uniqueIds = [...new Set((productIds || [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id)))];

    if (uniqueIds.length === 0) return [];

    const chunks = [];
    for (let index = 0; index < uniqueIds.length; index += 80) {
        chunks.push(uniqueIds.slice(index, index + 80));
    }

    const batches = await Promise.all(chunks.map((ids) => supabaseFetch(
        `product_images?product_id=in.(${ids.join(',')})&select=${select}&order=product_id.asc&order=is_primary.desc&order=display_order.asc&order=id.asc&limit=1000`,
    )));

    return batches.flatMap((batch) => Array.isArray(batch) ? batch : []);
}
