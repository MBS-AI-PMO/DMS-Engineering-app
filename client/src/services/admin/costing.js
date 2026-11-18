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
    /* Prices a part with the full working shown. With file_ref the server
     * measures the file (a STEP can take a minute or two the first time). */
    preview: (body, opts) => http.post(`${base}/preview`, body, opts),
    /* Stores a CAD file for pricing (as the quote page does): { tempPath, filename }. */
    uploadCad: (file) => {
        const form = new FormData();
        form.append('file', file);
        return http.post('/upload-asset', form);
    },
};
