import sys
import json
from PySide6.QtWidgets import QApplication, QDialog, QTableWidgetItem, QMessageBox, QFileDialog
from PySide6.QtCore import Qt
from PySide6.QtGui import QStandardItemModel, QStandardItem

# Import the generated UI
from ui_programmer import Ui_Dialog

class ProgrammerDialog(QDialog):
    def __init__(self):
        super().__init__()
        self.ui = Ui_Dialog()
        self.ui.setupUi(self)

        # Initialize data structures
        self.selected_leds = set()  # Set of selected LED indices
        self.led_steps = {}  # Dictionary to store steps for each LED

        # Connect signals to slots
        self.ui.select_deselect.clicked.connect(self.toggle_all_leds)
        self.ui.addStep.clicked.connect(self.add_step)
        self.ui.removeStep.clicked.connect(self.remove_step)
        self.ui.saveProgram.clicked.connect(self.save_program)
        self.ui.loadProgram.clicked.connect(self.load_program)
        self.ui.clearAll.clicked.connect(self.clear_programs)
        self.ui.selectStepType.currentIndexChanged.connect(self.update_step_fields)

        # Connect LED buttons to toggle selection
        for i in range(1, 25):
            button = getattr(self.ui, f"well{i:02d}")
            button.clicked.connect(lambda _, idx=i: self.toggle_led_selection(idx))

        # Initialize table view
        self.model = QStandardItemModel()
        self.ui.tableView.setModel(self.model)

        # Hide unnecessary fields initially
        self.update_step_fields()

    def toggle_led_selection(self, led_index):
        """Toggle the selection of an LED and update its button color."""
        if led_index in self.selected_leds:
            self.selected_leds.remove(led_index)
            button = getattr(self.ui, f"well{led_index:02d}")
            button.setStyleSheet("")  # Reset button color
        else:
            self.selected_leds.add(led_index)
            button = getattr(self.ui, f"well{led_index:02d}")
            button.setStyleSheet("background-color: lightblue;")  # Highlight selected LED

        self.update_table()

    def toggle_all_leds(self):
        """Toggle the selection of all LEDs."""
        if len(self.selected_leds) == 24:
            self.selected_leds.clear()
            for i in range(1, 25):
                button = getattr(self.ui, f"well{i:02d}")
                button.setStyleSheet("")
        else:
            self.selected_leds = set(range(1, 25))
            for i in range(1, 25):
                button = getattr(self.ui, f"well{i:02d}")
                button.setStyleSheet("background-color: lightblue;")

        self.update_table()

    def add_step(self):
        """Add a step to the selected LEDs."""
        step_type = self.ui.selectStepType.currentText()
        intensity = self.ui.int_2.value()
        int0 = self.ui.int0.value()
        int1 = self.ui.int1.value()
        duration = self.ui.duration_ms.value()
        freq = self.ui.freq_Hz.value()

        step = {
            "type": step_type,
            "int": intensity,
            "int0": int0,
            "int1": int1,
            "duration_ms": duration,
            "freq": freq
        }

        for led in self.selected_leds:
            led_key = f"LED{led - 1}"  # Convert LED index to "LED0", "LED1", etc.
            if led_key not in self.led_steps:
                self.led_steps[led_key] = []
            self.led_steps[led_key].append(step)

        self.update_table()

    def remove_step(self):
        """Remove the last step from the selected LEDs."""
        for led in self.selected_leds:
            led_key = f"LED{led - 1}"  # Convert LED index to "LED0", "LED1", etc.
            if led_key in self.led_steps and self.led_steps[led_key]:
                self.led_steps[led_key].pop()

        self.update_table()

    def update_step_fields(self):
        """Show/hide fields based on the selected step type."""
        step_type = self.ui.selectStepType.currentText()
        if step_type == "ON":
            self.ui.int0.hide()
            self.ui.int1.hide()
            self.ui.freq_Hz.hide()
            self.ui.int_2.show()  # Show intensity for ON
            self.ui.int_2.setEnabled(True)  # Ensure intensity is enabled for ON
        elif step_type == "OFF":
            self.ui.int0.hide()
            self.ui.int1.hide()
            self.ui.freq_Hz.hide()
            self.ui.int_2.hide()  # Hide intensity for OFF
        elif step_type == "RAMP":
            self.ui.int0.show()
            self.ui.int1.show()
            self.ui.freq_Hz.hide()
            self.ui.int_2.hide()  # Hide intensity for RAMP
        elif step_type == "SINE":
            self.ui.int0.show()
            self.ui.int1.show()
            self.ui.freq_Hz.show()
            self.ui.int_2.hide()  # Hide intensity for SINE

        # Always show the duration field for all step types
        self.ui.duration_ms.show()

    def update_table(self):
        """Update the table view with the steps for the selected LEDs."""
        self.model.clear()
        self.model.setHorizontalHeaderLabels(["LED", "Type", "Intensity", "Duration"])

        for led in self.selected_leds:
            led_key = f"LED{led - 1}"  # Convert LED index to "LED0", "LED1", etc.
            if led_key in self.led_steps:
                for step in self.led_steps[led_key]:
                    self.model.appendRow([
                        QStandardItem(led_key),
                        QStandardItem(step["type"]),
                        QStandardItem(str(step["int"])),
                        QStandardItem(str(step["duration_ms"]))
                    ])

    def save_program(self):
        """Save the program data to a JSON file using a modal dialog."""
        # Open a modal dialog to select the folder
        folder_path = QFileDialog.getExistingDirectory(self, "Select Folder to Save Program")

        if folder_path:  # If the user selected a folder
            file_path = f"{folder_path}/program.json"
            with open(file_path, "w") as f:
                json.dump(self.led_steps, f, indent=4)
            QMessageBox.information(self, "Save Program", f"Program saved successfully to {file_path}!")
        else:
            QMessageBox.warning(self, "Save Program", "No folder selected. Program not saved.")

    def load_program(self):
        """Load the program data from a JSON file."""
        try:
            with open("program.json", "r") as f:
                self.led_steps = json.load(f)

            # Update the selected LEDs to include all LEDs with steps
            self.selected_leds = {int(led.replace("LED", "")) + 1 for led in self.led_steps.keys()}

            self.update_table()
            QMessageBox.information(self, "Load Program", "Program loaded successfully!")
        except FileNotFoundError:
            QMessageBox.warning(self, "Load Program", "No program.json file found.")

    def clear_programs(self):
        """Clear all program data."""
        self.led_steps.clear()
        self.selected_leds.clear()
        for i in range(1, 25):
            button = getattr(self.ui, f"well{i:02d}")
            button.setStyleSheet("")
        self.update_table()
        QMessageBox.information(self, "Clear Programs", "All programs cleared.")

if __name__ == "__main__":
    app = QApplication(sys.argv)
    dialog = ProgrammerDialog()
    dialog.show()
    sys.exit(app.exec())