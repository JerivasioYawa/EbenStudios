export function productDto(product) {
    return { ...product, price: product.priceCents / 100 };
}

export function orderDto(order) {
    return {
        ...order,
        total: order.totalCents / 100,
        user: { id: order.userId, name: order.customerName, email: order.customerEmail },
        items: order.items.map(item => ({
            ...item,
            price: item.unitPriceCents / 100,
            // Compatibility fields also come from immutable snapshots, not a live product join.
            product: { id: item.productId, name: item.productName, description: item.productDescription,
                imageUrl: item.productImageUrl, priceCents: item.unitPriceCents, price: item.unitPriceCents / 100 },
        })),
    };
}
