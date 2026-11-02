import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";

export const uploadsDirPath = path.resolve(process.env.UPLOAD_DIR || "uploads");
fs.mkdirSync(uploadsDirPath, { recursive: true });
const extensions = {"image/jpeg":".jpg", "image/png":".png", "image/webp":".webp", "image/gif":".gif"};
export const upload = multer({
    storage: multer.diskStorage({destination: uploadsDirPath, filename: (req,file,cb)=>cb(null,crypto.randomUUID()+extensions[file.mimetype])}),
    fileFilter(req,file,cb) { cb(extensions[file.mimetype] ? null : Object.assign(new Error("Only JPEG, PNG, WEBP, or GIF images are allowed."),{status:400}), Boolean(extensions[file.mimetype])); },
    limits: {fileSize:5*1024*1024, files:1, fields:10, parts:11},
});
// Header validation rejects obvious MIME spoofing. It is not a malware scanner or full decoder.
export async function verifyImage(req,res,next) {
    if (!req.file) return next();
    try {
        const file = await fs.promises.open(req.file.path,'r');
        const bytes = Buffer.alloc(12);
        try { await file.read(bytes,0,12,0); } finally { await file.close(); }
        const mime=req.file.mimetype;
        const valid = mime==='image/png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : mime==='image/jpeg' ? bytes[0]===255 && bytes[1]===216 && bytes[2]===255 : mime==='image/gif' ? ['GIF87a','GIF89a'].includes(bytes.subarray(0,6).toString()) : bytes.subarray(0,4).toString()==='RIFF' && bytes.subarray(8,12).toString()==='WEBP';
        if (!valid) throw Object.assign(new Error('Image content does not match its declared type.'),{status:400});
        next();
    } catch(error) { await fs.promises.unlink(req.file.path).catch(()=>{}); next(error); }
}
export function deleteLocalUpload(imageUrl) {
    if(!imageUrl)return;
    try { const pathname=new URL(imageUrl,'http://local').pathname; if(pathname.startsWith('/uploads/')) fs.unlink(path.join(uploadsDirPath,path.basename(pathname)),()=>{}); } catch { /* External images are not managed here. */ }
}
