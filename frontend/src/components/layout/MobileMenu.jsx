import {useEffect,useRef} from 'react';
import {X} from 'lucide-react';
import {Link} from 'react-router-dom';
export default function MobileMenu({isOpen,onClose}) {
 const dialog=useRef(null);
 useEffect(()=>{if(isOpen)dialog.current?.showModal();else dialog.current?.close();},[isOpen]);
 return <dialog ref={dialog} onCancel={onClose} onClick={e=>{if(e.target===dialog.current)onClose();}} className="m-auto p-6 rounded-2xl w-[85%] max-w-sm backdrop:bg-black/50">
 <div className="flex justify-between"><h2 className="font-bold">Menu</h2><button aria-label="Close navigation" onClick={onClose}><X/></button></div>
 <nav aria-label="Mobile navigation" className="flex flex-col gap-5 mt-6">{[['/','Home'],['/shop','Products'],['/contact','Contact'],['/cart','Cart'],['/profile','Profile'],['/orders','My orders']].map(([to,label])=><Link key={to} to={to} onClick={onClose}>{label}</Link>)}</nav></dialog>;
}
