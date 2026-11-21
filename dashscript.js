
// SAYFA GEÇİŞLERİ

// SAYFA GEÇİŞLERİ
const dashboard = document.getElementById("dashboardContent");
const garage = document.getElementById("garageContent");
const maintenance = document.getElementById("maintenanceContent");
const expenses = document.getElementById("expensesContent");
const settings = document.getElementById("settingsContent");


const dashboardLink = document.getElementById("dashboardLink");
const garageLink = document.getElementById("garageLink");
const maintenanceLink = document.getElementById("maintenanceLink");
const expensesLink = document.getElementById("expensesLink");
const settingsLink = document.getElementById("settingsLink");

const sections = [
    dashboard,garage,maintenance,expenses,settings
];

const links = [
    dashboardLink,garageLink,maintenanceLink,expensesLink,settingsLink
];

function showPage(selectedSection, selectedLink) {
    sections.forEach(function(section) {
        section.classList.add("d-none");
    });

    links.forEach(function(link) {
        link.classList.remove("active");
    });

    selectedSection.classList.remove("d-none");
    selectedLink.classList.add("active");
}

dashboardLink.addEventListener("click", function(event) {
    event.preventDefault();
    showPage(dashboard, dashboardLink);
});

garageLink.addEventListener("click", function(event) {
    event.preventDefault();
    showPage(garage, garageLink);
});

maintenanceLink.addEventListener("click", function(event) {
    event.preventDefault();
    showPage(maintenance, maintenanceLink);
});

expensesLink.addEventListener("click", function(event) {
    event.preventDefault();
    showPage(expenses, expensesLink);
});
settingsLink.addEventListener("click", function(event) {
    event.preventDefault();
    showPage(settings, settingsLink);
});



// ARAÇ EKLEME
const vehicleForm = document.getElementById("addVehicleForm");
const garageList = document.getElementById("garageList");
const garageEmpty = document.getElementById("garageEmpty");
const totalVehicles = document.getElementById("totalVehicles");

const dashboardGarageList = document.getElementById("dashboardGarageList");
const dashboardGarageEmpty = document.getElementById("dashboardGarageEmpty");

let vehicleCount = 0;

vehicleForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const brand = document.getElementById("carBrand").value.trim();
    const model = document.getElementById("carModel").value.trim();
    const year = document.getElementById("carYear").value;
    const mileage = document.getElementById("carMileage").value;
    const plate = document.getElementById("carPlate").value.trim();

    // GARAGE İÇİN KART
    const column = document.createElement("div");
    column.className = "col-md-6 col-xl-4";

    const card = document.createElement("div");
    card.className = "card bg-black text-white border-secondary p-4 h-100";

    const icon = document.createElement("i");
    icon.className = "fa-solid fa-car-side fa-2x text-primary mb-3";

    const title = document.createElement("h5");
    title.textContent = brand + " " + model;

    const details = document.createElement("p");
    details.className = "text-secondary mb-2";
    details.textContent = year + " · " + Number(mileage).toLocaleString("tr-TR") + " km";

    const plateText = document.createElement("small");
    plateText.className = "text-secondary";
    plateText.textContent = plate;

    card.append(icon, title, details, plateText);
    column.appendChild(card);
    garageList.appendChild(column);

    // DASHBOARD'DAKİ ARAÇ LİSTESİ
    const vehicleRow = document.createElement("div");
    vehicleRow.className = "border-bottom border-secondary pb-3 mb-3";

    const vehicleName = document.createElement("h6");
    vehicleName.textContent = brand + " " + model;

    const vehicleDetails = document.createElement("small");
    vehicleDetails.className = "text-secondary";
    vehicleDetails.textContent = year + " · " + Number(mileage).toLocaleString("tr-TR") + " km";

    vehicleRow.append(vehicleName, vehicleDetails);
    dashboardGarageList.appendChild(vehicleRow);

    // İSTATİSTİKLERİ GÜNCELLE
    vehicleCount++;
    totalVehicles.textContent = vehicleCount;

    garageEmpty.classList.add("d-none");
    dashboardGarageEmpty.classList.add("d-none");

    // MODALI KAPAT VE FORMU TEMİZLE
    bootstrap.Modal.getInstance(document.getElementById("addVehicleModal")).hide();
    vehicleForm.reset();

    
});


// MAINTENANCE KAYITLARI
const maintenanceForm = document.getElementById("maintenanceForm");
const maintenanceRecords = [];

// Bakım kaydını belirtilen bölüme ekler.
function addMaintenanceCard(containerId, record) {
    const container = document.getElementById(containerId);

    if (!container) return;

    // İlk kayıt eklenirken "No records yet" mesajını kaldır.
    if (container.dataset.hasRecords !== "true") {
        container.replaceChildren();
        container.classList.remove("text-center", "py-4", "py-5");
        container.dataset.hasRecords = "true";
    }

    const item = document.createElement("div");
    item.className = "d-flex justify-content-between align-items-center gap-3 border-bottom border-secondary pb-3 mb-3";

    const info = document.createElement("div");

    const title = document.createElement("h6");
    title.className = "mb-1";
    title.textContent = record.type;

    const details = document.createElement("small");
    details.className = "text-secondary";
    details.textContent = record.vehicle + " · " + record.date;

    const cost = document.createElement("span");
    cost.className = "text-primary fw-bold";
    cost.textContent = "₺" + record.cost.toLocaleString("tr-TR");

    info.append(title, details);
    item.append(info, cost);

    container.prepend(item);
}

// SAVE RECORD BUTONUNA BASILDIĞINDA
maintenanceForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const record = {
        vehicle: document.getElementById("maintenanceVehicle").value.trim(),
        type: document.getElementById("serviceType").value,
        status: document.getElementById("serviceStatus").value,
        date: document.getElementById("serviceDate").value,
        mileage: Number(document.getElementById("serviceMileage").value),
        cost: Number(document.getElementById("serviceCost").value) || 0,
        notes: document.getElementById("serviceNotes").value.trim()
    };

    maintenanceRecords.push(record);

    renderExpenses();

    if (record.status === "completed") {

        // Maintenance → Service History
        addMaintenanceCard("serviceHistoryList", record);

        // Dashboard → Recent Maintenance
        addMaintenanceCard("recentMaintenanceList", record);

    } else {

        // Maintenance → Upcoming Services
        addMaintenanceCard("scheduledServicesList", record);

        // Dashboard → Upcoming Maintenance
        addMaintenanceCard("upcomingMaintenanceList", record);
    }

    // DASHBOARD SAYAÇLARINI GÜNCELLE
    const completed = maintenanceRecords.filter(
        item => item.status === "completed"
    );

    const scheduled = maintenanceRecords.filter(
        item => item.status === "scheduled"
    );

    const totalCost = completed.reduce(
        (sum, item) => sum + item.cost, 0
    );

    document.getElementById("completedServicesCount").textContent = completed.length;
    document.getElementById("upcomingServicesCount").textContent = scheduled.length;
    document.getElementById("totalExpenses").textContent = "₺" + totalCost.toLocaleString("tr-TR");

    // MODALI KAPAT
    bootstrap.Modal.getInstance(
        document.getElementById("addMaintenanceModal")
    ).hide();

    maintenanceForm.reset();
});


// EXPENSES SAYFASINI GÜNCELLE
function renderExpenses() {

    const completed = maintenanceRecords.filter(
        record => record.status === "completed"
    );

    const total = completed.reduce(
        (sum, record) => sum + record.cost, 0
    );

    document.getElementById("expensesPageTotal").textContent =
        "₺" + total.toLocaleString("tr-TR");

    document.getElementById("expensesPageCount").textContent =
        completed.length;

    const expensesList = document.getElementById("expensesList");
    const expensesEmpty = document.getElementById("expensesEmpty");

    expensesList.replaceChildren();

    expensesEmpty.classList.toggle(
        "d-none", completed.length > 0
    );

    completed.forEach(function(record) {

        const item = document.createElement("div");
        item.className =
            "d-flex justify-content-between align-items-center gap-3 border-bottom border-secondary pb-3 mb-3";

        const info = document.createElement("div");

        const title = document.createElement("h6");
        title.textContent = record.type;

        const details = document.createElement("small");
        details.className = "text-secondary";
        details.textContent =
            record.vehicle + " · " + record.date;

        const cost = document.createElement("span");
        cost.className = "text-primary fw-bold";
        cost.textContent =
            "₺" + record.cost.toLocaleString("tr-TR");

        info.append(title, details);
        item.append(info, cost);

        expensesList.appendChild(item);
    });
}


// SETTINGS
const logoutButton = document.getElementById("logoutButton");
const settingsUsername = document.getElementById("settingsUsername");

// Demo kullanıcı adını göster.
const username = sessionStorage.getItem("pitstopDemoUser");

settingsUsername.value = username || "Guest";

// LOG OUT
logoutButton.addEventListener("click", function() {

    sessionStorage.removeItem("pitstopDemoUser");

    window.location.href = "index.html";
});

