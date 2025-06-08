const dotenv=require('dotenv');
dotenv.config();
const express= require('express');
const app= express();
app.use(express.json());
const PORT=process.env.PORT||3000;
let db;


const {connectToMongoDB,disconnectFromMongoDB,client}=require('./src/mongodb');

app.use((req,res,next)=>{
    res.header("Content-Type","application/json; charset=utf-8"); //especifico el set de caraacteres para poder ver los datos
    next();
})

app.listen(PORT, async () => {
    try {
        await client.connect(); 
        db = client.db('Supermercado'); //le envio el nombre de mi base de datos
        console.log(`Servidor corriendo en el puerto:  ${PORT}`);
    } catch (error) {
        console.error('Error al conectar con MongoDB:', error);
    }
});

app.get('/',(req,res)=>{
    res.status(200).end('Bienvenidos a nuesta API de Productos');
})

app.get('/productos', async(req,res)=>{
    const client=await connectToMongoDB();
    if(!client){  //si no logro conectar salgo sin ejecutar ninguna otra instruccion
        res.status(500).send('Error al conectar a la base de datos desde app/productos');
        return;
    }
    const db= client.db('Supermercado'); // donde va a buscar
    const Productos=await db.collection('Productos').find().toArray();

    await disconnectFromMongoDB();
    res.json(Productos);
})

app.get('/productos/:id', async(req,res)=>{
    const prodID = parseInt(req.params.id) || 0; //tomo el id
    const client = await connectToMongoDB();

    if (!client) {
        return res.status(500).send('Error al conectar a MongoDB');
    }

    try {
        const db = client.db('Supermercado');
        const prod = await db.collection('Productos').findOne({ id: prodID });

        if (!prod) {
            return res.status(404).send('Producto no encontrado');
        }

        res.status(200).json(prod);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al buscar el producto');
    } finally {
        await client.close();
    }
});

app.get('/Productos/name/:nombre', async (req, res) => {
    const nombreParcial = req.params.nombre; 
    const client = await connectToMongoDB();

    if (!client) {
        return res.status(500).send('Error al conectarse a Mongo');
    }

    try {
        const db = client.db('Supermercado'); 
        const Productos = await db.collection('Productos').find({ //busca coincidencias y las almacena 
            nombre: { $regex: nombreParcial, $options: 'i' } // $regex se usa dentro de una consulta de MongoDB para comparar cadenas de texto mediante patrones. $options: 'i' se usa para ignorar mayúsculas y minúsculas
        }).toArray(); //recoge los resultados del cursor y los convierte en un array normal de objetos JavaScript

        if (Productos.length === 0) { //evalua si el array Productos esta vacio 
            return res.status(404).send('No se encontraron productos con ese nombre');
        }
        res.json(Productos);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al buscar el producto solicitado');
    } finally {
        client.close();
    }
});

//Modificar un elemento
app.put("/Productos/:id", async (req, res) => {
    const id = req.params.id;
    const datosAModificar = req.body;

    if (!datosAModificar || Object.keys(datosAModificar).length === 0) { //evaluo si el formato es correcto y si el body no esta vacio
        return res.status(400).send('Error en el formato de datos');
    }

    const client = await connectToMongoDB();
    if (!client) {
        return res.status(500).send('Error al conectar con Mongo');
    }

    const collection = client.db('Supermercado').collection('Productos');
    collection.updateOne({ id: parseInt(id) }, { $set: datosAModificar }) //$set es un operador de actualización utilizado en MongoDB 

        .then(() => {
            console.log('Datos modificados exitosamente');
            res.status(200).send(datosAModificar);
        })
        .catch((error) => {
            res.status(500).json({ descripcion: 'Error al modificar el recurso' });
        })
        .finally(() => {
            client.close();
        });
});

//agregar un nuevo recurso 
app.post('/Productos', async(req,res)=>{
    const nueProd=req.body; //capto los datos del body
        if(nueProd === undefined){ //evaluo el formato
            return res.status(400).send('Error en el formato de datos');
         }

        if(!client){
            return res.status(500).send('Error al conectar a la base de datos');
        }

    const collection= client.db('Supermercado').collection('Productos'); //conecta a la base de datos  y accede a Productos
        collection.insertOne(nueProd)
        .then(()=>{
            console.log('Nuevao prod creado');
            res.status(201).send(nueProd);
        })
        .catch(error =>{
            console.error(error);
        })
        .finally(()=>{
            client.close(); //cierro coneccion a mongo
        })

})


//eliminar un recurso
app.delete('/Productos/:id', async (req,res)=>{
    const id= req.params.id; //tomo el id ingresado
        if(!req.params.id){
            return res.status(400).send('El formato del id no es correcto');
        }
    
    const client= await connectToMongoDB();
        if(!client){
            return res.status(500).send('Error al conectarse a Mongo');
        }

    client.connect()
        .then(()=>{
            const collection= client.db('Supermercado').collection('Productos');
            return collection.deleteOne({id: parseInt(id)});
        })
        .then((resultado)=>{
            if(resultado.deletedCount===0){
                res.status(404).send('No se encontro un recurso con el ID ingresado');
            } else{
                console.log('Eliminado correctamente')
                res.status(204).send();
            }
        })
        .catch((error)=>{
            console.error(error);
            res.status(500).send('Se produjo un error al intentar eliminar el producto');
        })
        .finally(()=>{
            client.close();
        })

})