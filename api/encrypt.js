export default async function handler(req,res){

if(req.method !== "POST"){
return res.status(405).json({error:"Method not allowed"})
}

const { lua } = req.body

try{

const response = await fetch("https://luaobfuscator.com/api/obfuscate",{
method:"POST",
headers:{
"Content-Type":"application/json",
"apikey":process.env.LUA_OBF_API
},
body:JSON.stringify({
script:lua
})
})

const data = await response.json()

res.status(200).json({
result:data.obfuscated || "Encryption failed"
})

}catch(err){

res.status(500).json({
result:"Server error"
})

}

}
