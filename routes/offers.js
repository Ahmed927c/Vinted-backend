const express = require('express');
const fileUpload = require('express-fileupload');
const router = express.Router();

const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET,
});

const Offer = require('../models/Offer');
const User = require('../models/User');

const convertToBase64 = file => {
    return `data:${file.mimetype};base64,${file.data.toString('base64')}`;
};

const isAuthenticated = async (req, res, next) => {
    if (req.headers.authorization) {
        const user = await User.findOne({
            token: req.headers.authorization.replace('Bearer ', ''),
        });

        if (user) {
            req.user = user;
            next();
        } else {
            res.status(401).json({ error: 'Token présent mais non valide !' });
        }
    } else {
        res.status(401).json({ error: 'Token non envoyé !' });
    }
};

router.post('/offer/publish', isAuthenticated, async (req, res) => {
    try {
        const { title, description, price, condition, city, brand, size, color } =
            req.body;

        const newOffer = new Offer({
            product_name: title,
            product_description: description,
            product_price: price,
            product_details: [
                { MARQUE: brand },
                { TAILLE: size },
                { ETAT: condition },
                { COULEUR: color },
                { EMPLACEMENT: city },
            ],
            owner: req.user,
        });

        //J'envoie mon image sur cloudinary, juste après avoir créer en DB mon offre
        // Comme ça j'ai accès à mon ID
        const result = await cloudinary.uploader.upload(req.files.picture.path, {
            folder: 'vinted/offers',
            public_id: `${req.body.title} - ${newOffer._id}`,
          });
        // const result = await cloudinary.uploader.upload(
        //     convertToBase64(req.files.picture),
        //     {
        //         folder: 'vinted/offers',
        //         public_id: `${req.body.title} - ${newOffer._id}`,
        //         //Old WAY JS
        //         // public_id: req.body.title + " " + newOffer._id,
        //     },
        // );

        // console.log(result);
        //je viens rajouter l'image à mon offre
        newOffer.product_image = result;

        await newOffer.save();

        res.json(newOffer);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.get('/offers', async (req, res) => {
    let filters = {};

    if (req.query.title) {
        filters.product_name = new RegExp(req.query.title, 'i');
    }

    if (req.query.priceMin) {
        filters.product_price = { $gte: req.query.priceMin };
    }

    //Si j'ai une déjà une clé product_price dans min object objectFilter
    if (req.query.priceMax) {
        if (filters.product_price) {
            filters.product_price.$lte = req.query.priceMax;
        } else {
            filters.product_price = { $lte: req.query.priceMax };
        }
    }

    // console.log(filtersObject);

    //gestion du tri avec l'objet sortObject
    const sortObject = {};

    if (req.query.sort === 'price-desc') {
        sortObject.product_price = 'desc';
    } else if (req.query.sort === 'price-asc') {
        sortObject.product_price = 'asc';
    }

    //gestion de la pagination
    let sort = {};

    if (req.query.sort === 'price-desc') {
        sort = { product_price: -1 };
    } else if (req.query.sort === 'price-asc') {
        sort = { product_price: 1 };
    }

    let page;
    if (Number(req.query.page) < 1) {
        page = 1;
    } else {
        page = Number(req.query.page);
    }

    let limit = Number(req.query.limit);

    const offers = await Offer.find(filters)
        .populate({
            path: 'owner',
            select: 'account',
        })
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit);

    const count = await Offer.countDocuments(filters);

    res.json({
        count: count,
        offers: offers,
    });
});

router.get('/offer/:id', async (req, res) => {
    console.log(req.params);
    try {
        const offer = await Offer.findById(req.params.id).populate({
            path: 'owner',
            select: 'account.username email',
        });
        res.json(offer);
    } catch (error) {
        res.status(400).json(error.message);
    }
});

module.exports = router;
