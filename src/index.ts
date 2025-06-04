const singleTableFilterParams = {
    search: {
        columns: ["column1", "column2"],
        value: "search_value",
    },
    category: "category_name",
    price: {
        min: 10,
        max: 50,
    },
    colors: ["red", "blue"],
}

const multiTableFilterParams = {
    search: {
        columns: ["users.id", "users.name", "users.email"],
        value: "search_value",
    },
    "users.age": {
        min: 18,
        max: 65,
    },
    "orders.status": "completed",
}