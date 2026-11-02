import { useEffect, useState } from 'react';
import { getProducts } from '../../service/productService';
import ProductGrid from '../products/ProductGrid';
import Button from '../ui/Button';
export default function FeaturedProducts() {
 const [products,setProducts]=useState([]), [state,setState]=useState('loading'), [attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true; getProducts().then(data=>{if(active){setProducts(data.slice(0,4));setState('ready');}}).catch(()=>{if(active)setState('error');}); return ()=>{active=false;};},[attempt]);
 return <section className="max-w-7xl mx-auto px-6 py-16"><h2 className="text-4xl font-black mb-8">Featured Products</h2>
 {state==='loading' && <p role="status">Loading products...</p>}
 {state==='error' && <p role="alert">Products could not load. <button onClick={()=>{setState('loading');setAttempt(attempt+1);}}>Retry</button></p>}
 {state==='ready' && (products.length ? <ProductGrid products={products}/> : <p>No products available yet.</p>)}
 <Button to="/shop">View all products</Button></section>;
}
