import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import Link from './models/Link.js';
import path from 'path';


const app = express();
app.use(express.json());
const __dirname = path.resolve();

const connectDB = async() =>{
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    if (conn) {
        console.log ('MongoDB connected');
    }
};
connectDB();

app.post("/link", async (req,res)=>{
    const {url,slug}= req.body;
    const randomSlug = Math.random().toString(36).substring(2,7);
    const link =new Link({
        url:url,
        slug:slug || randomSlug,
    })
    try{
        const savedLink = await link.save();
       return res.json({
            success:true,
            data:{
                url:savedLink.url,
                slug: savedLink.slug,
                shortUrl:`${process.env.BASE_URL}/${savedLink.slug}`
            },
            message :"Links Saved Successfully"
        })
    }
    catch(err){
       return res.json({
            success:false,
            message:err.message
        })
    }
})

// get
app.get('/:slug', async(req,res)=>{

    const {slug}= req.params;
  
    const link = await Link.findOne({slug:slug});
  
    if(!link){
      return res.json({
        success:false,
        message:"link not found"
  
      })
    }
  
    await  Link.updateOne({slug:slug},{$set:{
      clicks : link.clicks + 1
     }})
  
    res.redirect(link.url)
  })
app.get("/api/links", async (req,res)=>{
    const links = await Link.find({});
    return res.json({
        success:true,
        data:links,
        message: "Links fetched successfully"
    })
})
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '..', 'client', 'build')));
  
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '..', 'client', 'build', 'index.html'))
    });
  }
  

const PORT = process.env .PORT || 5000;

app.listen(PORT, () =>{
    console.log(`Server is running on port ${PORT}`);
});