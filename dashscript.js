const sectionNames = ["dashboard", "garage", "maintenance", "expenses", "settings"];
let currentSection = "dashboard";
for (const name of sectionNames) {
    byId(name + "Link").addEventListener("click", event => {
        event.preventDefault();
        for (const section of sectionNames) {
            byId(section + "Content").classList.toggle("d-none", section !== name);
            byId(section + "Link").classList.toggle("active", section === name);
        }
        currentSection = name;
        if (recordsReady && name !== "settings") refreshRecords(name);
    });
}

let vehicles = new Map();
let maintenanceRecords = [];
let recordsReady = false;
let recordsBusy = false;
let refreshVersion = 0;
const money = new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
});
const kilometers = new Intl.NumberFormat("tr-TR");

function element(tag, className, text = "") {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
}

function vehicleName(vehicle) {
    return vehicle.brand + " " + vehicle.model;
}

function recordActions(label, edit, remove) {
    const actions = element("div", "d-flex flex-wrap gap-2 mt-2");
    const editButton = element("button", "btn btn-sm btn-outline-light", "Edit");
    const deleteButton = element("button", "btn btn-sm btn-outline-danger", "Delete");
    for (const button of [editButton, deleteButton]) {
        button.type = "button";
        button.dataset.recordAction = "";
        button.setAttribute("aria-label", button.textContent + " " + label);
    }
    editButton.addEventListener("click", edit);
    deleteButton.addEventListener("click", remove);
    actions.append(editButton, deleteButton);
    return actions;
}

function renderGarage() {
    const garageList = byId("garageList");
    const summaryList = byId("dashboardGarageList");
    const select = byId("maintenanceVehicle");
    const selectedVehicle = select.value;
    garageList.replaceChildren();
    summaryList.replaceChildren();
    select.length = 1;

    for (const vehicle of vehicles.values()) {
        const name = vehicleName(vehicle);
        const vehicleLabel = name + " · " + vehicle.plate;
        const details = vehicle.year + " · " + kilometers.format(vehicle.mileage) + " km";
        const column = element("div", "col-md-6 col-xl-4");
        const card = element("div", "card bg-black text-white border-secondary p-4 h-100");
        card.append(
            element("i", "fa-solid fa-car-side fa-2x text-primary mb-3"),
            element("h5", "text-break", name),
            element("p", "text-secondary mb-2", details),
            element("small", "text-secondary text-break", vehicle.plate),
            recordActions(
                "vehicle " + vehicleLabel,
                () => editVehicle(vehicle),
                () => deleteVehicle(vehicle)
            )
        );
        column.append(card);
        garageList.append(column);

        const summary = element("div", "border-bottom border-secondary pb-3 mb-3");
        summary.append(element("h6", "text-break", name), element("small", "text-secondary", details));
        summaryList.append(summary);
        select.add(new Option(vehicleLabel, vehicle.id));
    }

    select.value = vehicles.has(Number(selectedVehicle)) ? selectedVehicle : "";
    byId("garageEmpty").classList.toggle("d-none", vehicles.size > 0);
    byId("dashboardGarageEmpty").classList.toggle("d-none", vehicles.size > 0);
    byId("maintenanceVehicleHint").classList.toggle("d-none", vehicles.size > 0);
    byId("totalVehicles").textContent = vehicles.size;
}

function maintenanceRow(record, showDetails) {
    const row = element("div", "d-flex flex-wrap justify-content-between align-items-start gap-2 border-bottom border-secondary pb-3 mb-3");
    const vehicle = vehicles.get(record.vehicle_id);
    const info = element("div", "text-break");
    const label = vehicleName(vehicle) + " · " + record.service_date;
    info.append(
        element("h6", "mb-1", record.service_type),
        element("small", "text-secondary", label)
    );
    if (showDetails) {
        info.append(element("small", "d-block text-secondary", kilometers.format(record.mileage) + " km"));
        if (record.notes) {
            info.append(element("small", "d-block text-secondary", record.notes));
        }
        info.append(recordActions(
            "service " + record.service_type + " · " + label,
            () => editMaintenance({ ...record, cost: (record.cost_cents / 100).toFixed(2) }),
            () => deleteMaintenance(record)
        ));
    }
    row.append(info, element("span", "text-primary fw-bold", money.format(record.cost_cents / 100)));
    return row;
}

function renderMaintenance() {
    const completed = maintenanceRecords.filter(record => record.status === "completed");
    const scheduled = maintenanceRecords.filter(record => record.status === "scheduled");

    const lists = [
        ["serviceHistoryList", completed, true],
        ["recentMaintenanceList", completed, false],
        ["scheduledServicesList", scheduled, true],
        ["upcomingMaintenanceList", scheduled, false],
        ["expensesList", completed, false]
    ];
    for (const [id, records, showDetails] of lists) {
        const list = byId(id);
        const empty = byId(id + "Empty");
        list.replaceChildren(...records.map(record => maintenanceRow(record, showDetails)));
        empty.classList.toggle("d-none", records.length > 0);
    }

    const totalCents = completed.reduce((sum, record) => sum + record.cost_cents, 0);
    const total = money.format(totalCents / 100);
    byId("totalExpenses").textContent = total;
    byId("expensesPageTotal").textContent = total;
    byId("completedServicesCount").textContent = completed.length;
    byId("expensesPageCount").textContent = completed.length;
    byId("upcomingServicesCount").textContent = scheduled.length;
}

function redirectIfSignedOut(error) {
    if (error.status !== 401) return false;
    window.location.replace("/?login=1");
    return true;
}

function updateRecordControls() {
    const disabled = !recordsReady || recordsBusy;
    byId("addVehicleButton").disabled = disabled;
    byId("saveVehicle").disabled = disabled;
    byId("addMaintenanceButton").disabled = disabled;
    byId("saveMaintenance").disabled = disabled || vehicles.size === 0;
    for (const button of document.querySelectorAll("[data-record-action]")) {
        button.disabled = disabled;
    }
}

function renderRecords() {
    renderGarage();
    renderMaintenance();
    updateRecordControls();
}

async function changeRecord(path, options, onSaved, errorId = "dashboardError") {
    if (recordsBusy) return false;
    recordsBusy = true;
    // Discard a list response that started before this change.
    refreshVersion++;
    setError(byId("dashboardError"));
    if (errorId !== "dashboardError") setError(byId(errorId));
    updateRecordControls();

    try {
        onSaved(await apiRequest(path, options));
        renderRecords();
        return true;
    } catch (error) {
        if (!redirectIfSignedOut(error)) setError(byId(errorId), error.message);
        return false;
    } finally {
        recordsBusy = false;
        updateRecordControls();
    }
}

function bindRecordForm({ formId, modalId, addButtonId, titleId, editTitle, errorId, endpoint, fields, onSaved }) {
    const form = byId(formId);
    const modal = byId(modalId);
    const title = byId(titleId);
    const addTitle = title.textContent.trim();
    const submit = form.querySelector('button[type="submit"]');
    let recordId = null;

    function prepare(record) {
        form.reset();
        setError(byId(errorId));
        recordId = record?.id ?? null;
        title.textContent = record ? editTitle : addTitle;
        if (record) {
            for (const [key, fieldId] of Object.entries(fields)) {
                byId(fieldId).value = record[key];
            }
        }
    }

    modal.addEventListener("show.bs.modal", event => {
        if (event.relatedTarget === byId(addButtonId)) prepare(null);
    });
    modal.addEventListener("hide.bs.modal", event => {
        if (recordsBusy) event.preventDefault();
    });

    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (submit.disabled) return;
        const data = Object.fromEntries(Object.entries(fields).map(([key, fieldId]) => [key, valueOf(fieldId)]));
        if (data.cost === "") data.cost = "0";
        const path = recordId === null ? endpoint : endpoint + "/" + recordId;
        const method = recordId === null ? "POST" : "PUT";
        if (await changeRecord(path, { method, data }, onSaved, errorId)) {
            bootstrap.Modal.getInstance(modal).hide();
            form.reset();
        }
    });

    return record => {
        prepare(record);
        bootstrap.Modal.getOrCreateInstance(modal).show();
    };
}

const editVehicle = bindRecordForm({
    formId: "addVehicleForm",
    modalId: "addVehicleModal",
    addButtonId: "addVehicleButton",
    titleId: "addVehicleModalLabel",
    editTitle: "Edit Vehicle",
    errorId: "vehicleError",
    endpoint: "vehicles",
    fields: { brand: "carBrand", model: "carModel", year: "carYear", mileage: "carMileage", plate: "carPlate" },
    onSaved: record => vehicles.set(record.id, record)
});

const editMaintenance = bindRecordForm({
    formId: "maintenanceForm",
    modalId: "addMaintenanceModal",
    addButtonId: "addMaintenanceButton",
    titleId: "maintenanceModalLabel",
    editTitle: "Edit Maintenance Record",
    errorId: "maintenanceError",
    endpoint: "maintenance",
    fields: {
        vehicle_id: "maintenanceVehicle", service_type: "serviceType", status: "serviceStatus",
        service_date: "serviceDate", mileage: "serviceMileage", cost: "serviceCost", notes: "serviceNotes"
    },
    onSaved: record => {
        maintenanceRecords = [record, ...maintenanceRecords.filter(item => item.id !== record.id)]
            .sort((first, second) => second.id - first.id);
    }
});

function deleteVehicle(vehicle) {
    if (!window.confirm("Delete " + vehicleName(vehicle) + " and all of its maintenance records?")) return;
    changeRecord("vehicles/" + vehicle.id, { method: "DELETE" }, () => {
        vehicles.delete(vehicle.id);
        maintenanceRecords = maintenanceRecords.filter(record => record.vehicle_id !== vehicle.id);
    });
}

function deleteMaintenance(record) {
    if (!window.confirm("Delete this " + record.service_type + " record?")) return;
    changeRecord("maintenance/" + record.id, { method: "DELETE" }, () => {
        maintenanceRecords = maintenanceRecords.filter(item => item.id !== record.id);
    });
}

byId("logoutButton").addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    setError(byId("dashboardError"));

    try {
        await apiRequest("logout", { method: "POST" });
        window.location.replace("/");
    } catch (error) {
        setError(byId("dashboardError"), error.message);
        button.disabled = false;
    }
});

async function refreshRecords(section) {
    if (recordsBusy) return;
    const version = ++refreshVersion;

    try {
        let vehicleRows;
        let records;
        if (section === "dashboard") {
            const data = await apiRequest("dashboard");
            if (version !== refreshVersion) return;
            byId("settingsUsername").value = data.user.nickname;
            byId("settingsEmail").value = data.user.email;
            vehicleRows = data.vehicles;
            records = data.maintenance;
        } else {
            [vehicleRows, records] = await Promise.all([apiRequest("vehicles"), apiRequest("maintenance")]);
            if (version !== refreshVersion) return;
        }

        vehicles = new Map(vehicleRows.map(vehicle => [vehicle.id, vehicle]));
        maintenanceRecords = records.filter(record => vehicles.has(record.vehicle_id));
        const firstLoad = !recordsReady;
        recordsReady = true;
        setError(byId("dashboardError"));
        renderRecords();
        if (firstLoad && currentSection !== "dashboard" && currentSection !== "settings") {
            refreshRecords(currentSection);
        }
    } catch (error) {
        if (version === refreshVersion && !redirectIfSignedOut(error)) {
            setError(byId("dashboardError"), error.message);
        }
    }
}

refreshRecords("dashboard");
