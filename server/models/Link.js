const mongoose = require("mongoose");

const linkSchema = new mongoose.Schema({
    url:{
        type:String,
        required: true,
    },
    slug:{
        type:String,
        required:true,
        unique:true,

    },
    clicks:{
     type:Number,
     required:true,
     default:0,
    }
    
},{
    timestamps:true,
});
const Link = mongoose.model('Link',linkSchema);


module.exports = Link;