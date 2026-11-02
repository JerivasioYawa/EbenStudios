import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
export default function SearchBar(){const [query,setQuery]=useState('');const navigate=useNavigate();return <form onSubmit={e=>{e.preventDefault();navigate(`/shop?q=${encodeURIComponent(query.trim())}`);}}><label className="sr-only" htmlFor="catalogue-search">Search products</label><input id="catalogue-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search products" className="border rounded-full px-4 py-2"/><button className="ml-2" type="submit">Search</button></form>;}
