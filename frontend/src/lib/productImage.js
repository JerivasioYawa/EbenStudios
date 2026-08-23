export function getProductImage(product) {
    if (product.imageUrl) {
        return product.imageUrl;
    }

    return `https://picsum.photos/seed/${encodeURIComponent(product.name)}/600/800`;
}
