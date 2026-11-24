const sectionNames = ["dashboard", "garage", "maintenance", "expenses", "settings"];
for (const name of sectionNames) {
    byId(name + "Link").addEventListener("click", event => {
        event.preventDefault();
        for (const section of sectionNames) {
            byId(section + "Content").classList.toggle("d-none", section !== name);
            byId(section + "Link").classList.toggle("active", section === name);
        }
    });
}

const vehicles = new Map();
const maintenanceRecords = [];
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

function addVehicle(vehicle) {
    vehicles.set(vehicle.id, vehicle);
    const name = vehicleName(vehicle);
    const details = vehicle.year + " · " + kilometers.format(vehicle.mileage) + " km";
    const column = element("div", "col-md-6 col-xl-4");
    const card = element("div", "card bg-black text-white border-secondary p-4 h-100");
    card.append(
        element("i", "fa-solid fa-car-side fa-2x text-primary mb-3"),
        element("h5", "", name),
        element("p", "text-secondary mb-2", details),
        element("small", "text-secondary", vehicle.plate)
    );
    column.append(card);
    byId("garageList").append(column);

    const summary = element("div", "border-bottom border-secondary pb-3 mb-3");
    summary.append(element("h6", "", name), element("small", "text-secondary", details));
    byId("dashboardGarageList").append(summary);

    byId("maintenanceVehicle").add(new Option(name + " · " + vehicle.plate, vehicle.id));
    byId("garageEmpty").classList.add("d-none");
    byId("dashboardGarageEmpty").classList.add("d-none");
    byId("maintenanceVehicleHint").classList.add("d-none");
    byId("saveMaintenance").disabled = false;
    byId("totalVehicles").textContent = vehicles.size;
}

function maintenanceRow(record, showDetails) {
    const row = element("div", "d-flex justify-content-between align-items-center gap-3 border-bottom border-secondary pb-3 mb-3");
    const vehicle = vehicles.get(record.vehicle_id);
    const info = element("div", "");
    info.append(
        element("h6", "mb-1", record.service_type),
        element("small", "text-secondary", vehicleName(vehicle) + " · " + record.service_date)
    );
    if (showDetails) {
        info.append(element("small", "d-block text-secondary", kilometers.format(record.mileage) + " km"));
        if (record.notes) {
            info.append(element("small", "d-block text-secondary text-break", record.notes));
        }
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

function bindRecordForm({ formId, modalId, errorId, endpoint, readData, onSaved }) {
    const form = byId(formId);
    const submit = form.querySelector('button[type="submit"]');
    const errorMessage = byId(errorId);
    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (submit.disabled) return;
        setError(errorMessage);
        submit.disabled = true;

        try {
            const record = await apiRequest(endpoint, { method: "POST", data: readData() });
            onSaved(record);
            form.reset();
            bootstrap.Modal.getInstance(byId(modalId))?.hide();
        } catch (error) {
            if (!redirectIfSignedOut(error)) setError(errorMessage, error.message);
        } finally {
            submit.disabled = false;
        }
    });
}

bindRecordForm({
    formId: "addVehicleForm",
    modalId: "addVehicleModal",
    errorId: "vehicleError",
    endpoint: "vehicles",
    readData: () => ({
        brand: valueOf("carBrand"),
        model: valueOf("carModel"),
        year: Number(valueOf("carYear")),
        mileage: Number(valueOf("carMileage")),
        plate: valueOf("carPlate")
    }),
    onSaved: addVehicle
});

bindRecordForm({
    formId: "maintenanceForm",
    modalId: "addMaintenanceModal",
    errorId: "maintenanceError",
    endpoint: "maintenance",
    readData: () => ({
        vehicle_id: Number(valueOf("maintenanceVehicle")),
        service_type: valueOf("serviceType"),
        status: valueOf("serviceStatus"),
        service_date: valueOf("serviceDate"),
        mileage: Number(valueOf("serviceMileage")),
        cost: valueOf("serviceCost") || "0",
        notes: valueOf("serviceNotes")
    }),
    onSaved: record => {
        maintenanceRecords.unshift(record);
        renderMaintenance();
    }
});

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

async function loadDashboard() {
    try {
        const data = await apiRequest("dashboard");
        byId("settingsUsername").value = data.user.nickname;
        byId("settingsEmail").value = data.user.email;
        for (const vehicle of data.vehicles) addVehicle(vehicle);
        for (const record of data.maintenance) maintenanceRecords.push(record);
        renderMaintenance();
        byId("saveVehicle").disabled = false;
    } catch (error) {
        if (!redirectIfSignedOut(error)) setError(byId("dashboardError"), error.message);
    }
}

loadDashboard();
