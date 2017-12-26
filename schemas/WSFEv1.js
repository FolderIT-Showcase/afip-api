module.exports = {
    FECAESolicitar: {
        ImpNeto: {
            type: "number",
            default: 0
        },
        ImpConc: {
            type: "number",
            default: 0
        },
        ImpOpEx: {
            type: "number",
            default: 0
        },
        ImpTrib: {
            type: "number",
            default: 0
        },
        ImpIva: {
            type: "number",
            default: 0
        },
        IdIVA: {
            type: "number"
        },
        DocNro: {
            type: "string",
            required: true,
            minLength: 1
        },
        PtoVta: {
            type: "number",
            required: true,
            minimum: 1,
            maximum: 9998
        },
        DocTipo: {
            type: "number",
            default: 80
        },
        CbteNro: {
            type: "number",
            required: true
        },
        CbteFch: {
            type: "string",
            isDate: true
        },
        Concepto: {
            type: "number",
            default: 2
        },
        CantReg: {
            type: "number",
            default: 1
        },
        CbteTipo: {
            type: "number",
            required: true
        },
        MonId: {
            type: "string",
            default: "PES"
        },
        MonCotiz: {
            type: "number",
            default: 1
        },
        Tributos: {
            type: "array",
            items: [{
                type: "object",
                properties: {
                    Id: {
                        type: "number",
                        required: true
                    },
                    Desc: {
                        type: "string"
                    },
                    BaseImp: {
                        type: "number",
                        default: 0
                    },
                    Alic: {
                        type: "number",
                        required: true
                    },
                    Importe: {
                        type: "number",
                        default: 0
                    }
                }
            }]
        }
    },
    FECompUltimoAutorizado: {
        PtoVta: {
            type: "number",
            required: true,
            minimum: 1,
            maximum: 9998
        },
        CbteTipo: {
            type: "number",
            required: true
        }
    },
    FECompConsultar: {
        PtoVta: {
            type: "number",
            required: true,
            minimum: 1,
            maximum: 9998
        },
        CbteTipo: {
            type: "number",
            required: true
        },
        CbteNro: {
            type: "number",
            required: true,
            minimum: 1,
            maximum: 99999999
        },
    }
};
