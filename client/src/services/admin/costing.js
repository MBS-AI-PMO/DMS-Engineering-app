import { adminHttp as http } from '../http';

/* Admin > Costing (backend/routes/costing.js, mounted at /api/costing). */
const base = '/costing/admin';

export const costingService = {
    /* Everything the Costing screens show, in one call. */
    config: () => http.get(`${base}/config`),
    /* collection: operations | sheet-sizes | sheet-costs | laser-rates | markups | add-ons */
    save: (collection, row) => (row.id
        ? http.put(`${base}/${collection}/${row.id}`, row)
        : http.post(`${base}/${collection}`, row)),
    remove: (collection, id) => http.delete(`${base}/${collection}/${id}`),
    setDefaultSize: (id) => http.put(`${base}/sheet-sizes/${id}/default`),
    /* Replaces every sheet cost row; dryRun only checks the rows. */
    importSheetCosts: (rows, dryRun) => http.post(`${base}/sheet-costs/import`, { rows, dryRun }),
    saveLinks: (serviceId, links) => http.put(`${base}/services/${serviceId}/links`, links),
    setMetalFamily: (id, costingFamily) => http.put(`${base}/metals/${id}/family`, { costing_family: costingFamily }),
    /* Prices a part with the full working shown. */
    preview: (body) => http.post(`${base}/preview`, body),
};
