# -*- coding: utf-8 -*-

################################################################################
## Form generated from reading UI file 'programmerciapLW.ui'
##
## Created by: Qt User Interface Compiler version 6.4.3
##
## WARNING! All changes made in this file will be lost when recompiling UI file!
################################################################################

from PySide6.QtCore import (QCoreApplication, QDate, QDateTime, QLocale,
    QMetaObject, QObject, QPoint, QRect,
    QSize, QTime, QUrl, Qt)
from PySide6.QtGui import (QBrush, QColor, QConicalGradient, QCursor,
    QFont, QFontDatabase, QGradient, QIcon,
    QImage, QKeySequence, QLinearGradient, QPainter,
    QPalette, QPixmap, QRadialGradient, QTransform)
from PySide6.QtWidgets import (QAbstractSpinBox, QApplication, QComboBox, QDialog,
    QGridLayout, QGroupBox, QHeaderView, QLabel,
    QPushButton, QSizePolicy, QSpinBox, QTableView,
    QWidget)

class Ui_Dialog(object):
    def setupUi(self, Dialog):
        if not Dialog.objectName():
            Dialog.setObjectName(u"Dialog")
        Dialog.resize(801, 705)
        self.select_deselect = QPushButton(Dialog)
        self.select_deselect.setObjectName(u"select_deselect")
        self.select_deselect.setGeometry(QRect(196, 200, 140, 24))
        self.groupBox = QGroupBox(Dialog)
        self.groupBox.setObjectName(u"groupBox")
        self.groupBox.setGeometry(QRect(520, 42, 211, 231))
        self.selectStepType = QComboBox(self.groupBox)
        self.selectStepType.addItem("")
        self.selectStepType.addItem("")
        self.selectStepType.addItem("")
        self.selectStepType.addItem("")
        self.selectStepType.setObjectName(u"selectStepType")
        self.selectStepType.setGeometry(QRect(10, 50, 171, 22))
        self.selectStepType.setLayoutDirection(Qt.LeftToRight)
        self.selectStepType.setEditable(False)
        self.addStep = QPushButton(self.groupBox)
        self.addStep.setObjectName(u"addStep")
        self.addStep.setGeometry(QRect(10, 20, 81, 24))
        font = QFont()
        font.setBold(False)
        self.addStep.setFont(font)
        self.removeStep = QPushButton(self.groupBox)
        self.removeStep.setObjectName(u"removeStep")
        self.removeStep.setGeometry(QRect(100, 20, 81, 24))
        self.int_2 = QSpinBox(self.groupBox)
        self.int_2.setObjectName(u"int_2")
        self.int_2.setGeometry(QRect(120, 80, 71, 22))
        self.int_2.setLayoutDirection(Qt.LeftToRight)
        self.int_2.setButtonSymbols(QAbstractSpinBox.UpDownArrows)
        self.int_2.setMaximum(1400)
        self.int0 = QSpinBox(self.groupBox)
        self.int0.setObjectName(u"int0")
        self.int0.setGeometry(QRect(120, 140, 71, 22))
        self.int0.setMaximum(1400)
        self.int1 = QSpinBox(self.groupBox)
        self.int1.setObjectName(u"int1")
        self.int1.setGeometry(QRect(120, 170, 71, 22))
        self.int1.setMaximum(1400)
        self.duration_ms = QSpinBox(self.groupBox)
        self.duration_ms.setObjectName(u"duration_ms")
        self.duration_ms.setGeometry(QRect(120, 110, 71, 22))
        self.duration_ms.setMaximum(10000000)
        self.freq_Hz = QSpinBox(self.groupBox)
        self.freq_Hz.setObjectName(u"freq_Hz")
        self.freq_Hz.setGeometry(QRect(120, 200, 71, 22))
        self.freq_Hz.setMaximum(100)
        self.label = QLabel(self.groupBox)
        self.label.setObjectName(u"label")
        self.label.setGeometry(QRect(10, 80, 101, 16))
        self.label_2 = QLabel(self.groupBox)
        self.label_2.setObjectName(u"label_2")
        self.label_2.setGeometry(QRect(10, 140, 91, 16))
        self.label_3 = QLabel(self.groupBox)
        self.label_3.setObjectName(u"label_3")
        self.label_3.setGeometry(QRect(10, 170, 91, 16))
        self.label_4 = QLabel(self.groupBox)
        self.label_4.setObjectName(u"label_4")
        self.label_4.setGeometry(QRect(10, 110, 91, 16))
        self.label_5 = QLabel(self.groupBox)
        self.label_5.setObjectName(u"label_5")
        self.label_5.setGeometry(QRect(10, 200, 91, 16))
        self.layoutWidget = QWidget(Dialog)
        self.layoutWidget.setObjectName(u"layoutWidget")
        self.layoutWidget.setGeometry(QRect(20, 50, 491, 141))
        self.wellPlateGrid = QGridLayout(self.layoutWidget)
        self.wellPlateGrid.setObjectName(u"wellPlateGrid")
        self.wellPlateGrid.setHorizontalSpacing(6)
        self.wellPlateGrid.setContentsMargins(0, 0, 0, 0)
        self.well01 = QPushButton(self.layoutWidget)
        self.well01.setObjectName(u"well01")
        self.well01.setAutoFillBackground(False)

        self.wellPlateGrid.addWidget(self.well01, 0, 0, 1, 1)

        self.well02 = QPushButton(self.layoutWidget)
        self.well02.setObjectName(u"well02")

        self.wellPlateGrid.addWidget(self.well02, 0, 1, 1, 1)

        self.well03 = QPushButton(self.layoutWidget)
        self.well03.setObjectName(u"well03")

        self.wellPlateGrid.addWidget(self.well03, 0, 2, 1, 1)

        self.well04 = QPushButton(self.layoutWidget)
        self.well04.setObjectName(u"well04")

        self.wellPlateGrid.addWidget(self.well04, 0, 3, 1, 1)

        self.well05 = QPushButton(self.layoutWidget)
        self.well05.setObjectName(u"well05")

        self.wellPlateGrid.addWidget(self.well05, 0, 4, 1, 1)

        self.well06 = QPushButton(self.layoutWidget)
        self.well06.setObjectName(u"well06")

        self.wellPlateGrid.addWidget(self.well06, 0, 5, 1, 1)

        self.well07 = QPushButton(self.layoutWidget)
        self.well07.setObjectName(u"well07")

        self.wellPlateGrid.addWidget(self.well07, 1, 0, 1, 1)

        self.well08 = QPushButton(self.layoutWidget)
        self.well08.setObjectName(u"well08")

        self.wellPlateGrid.addWidget(self.well08, 1, 1, 1, 1)

        self.well09 = QPushButton(self.layoutWidget)
        self.well09.setObjectName(u"well09")

        self.wellPlateGrid.addWidget(self.well09, 1, 2, 1, 1)

        self.well10 = QPushButton(self.layoutWidget)
        self.well10.setObjectName(u"well10")

        self.wellPlateGrid.addWidget(self.well10, 1, 3, 1, 1)

        self.well11 = QPushButton(self.layoutWidget)
        self.well11.setObjectName(u"well11")

        self.wellPlateGrid.addWidget(self.well11, 1, 4, 1, 1)

        self.well12 = QPushButton(self.layoutWidget)
        self.well12.setObjectName(u"well12")

        self.wellPlateGrid.addWidget(self.well12, 1, 5, 1, 1)

        self.well13 = QPushButton(self.layoutWidget)
        self.well13.setObjectName(u"well13")

        self.wellPlateGrid.addWidget(self.well13, 2, 0, 1, 1)

        self.well14 = QPushButton(self.layoutWidget)
        self.well14.setObjectName(u"well14")

        self.wellPlateGrid.addWidget(self.well14, 2, 1, 1, 1)

        self.well15 = QPushButton(self.layoutWidget)
        self.well15.setObjectName(u"well15")

        self.wellPlateGrid.addWidget(self.well15, 2, 2, 1, 1)

        self.well16 = QPushButton(self.layoutWidget)
        self.well16.setObjectName(u"well16")

        self.wellPlateGrid.addWidget(self.well16, 2, 3, 1, 1)

        self.well17 = QPushButton(self.layoutWidget)
        self.well17.setObjectName(u"well17")

        self.wellPlateGrid.addWidget(self.well17, 2, 4, 1, 1)

        self.well18 = QPushButton(self.layoutWidget)
        self.well18.setObjectName(u"well18")

        self.wellPlateGrid.addWidget(self.well18, 2, 5, 1, 1)

        self.well19 = QPushButton(self.layoutWidget)
        self.well19.setObjectName(u"well19")

        self.wellPlateGrid.addWidget(self.well19, 3, 0, 1, 1)

        self.well20 = QPushButton(self.layoutWidget)
        self.well20.setObjectName(u"well20")

        self.wellPlateGrid.addWidget(self.well20, 3, 1, 1, 1)

        self.well21 = QPushButton(self.layoutWidget)
        self.well21.setObjectName(u"well21")

        self.wellPlateGrid.addWidget(self.well21, 3, 2, 1, 1)

        self.well22 = QPushButton(self.layoutWidget)
        self.well22.setObjectName(u"well22")

        self.wellPlateGrid.addWidget(self.well22, 3, 3, 1, 1)

        self.well23 = QPushButton(self.layoutWidget)
        self.well23.setObjectName(u"well23")

        self.wellPlateGrid.addWidget(self.well23, 3, 4, 1, 1)

        self.well24 = QPushButton(self.layoutWidget)
        self.well24.setObjectName(u"well24")

        self.wellPlateGrid.addWidget(self.well24, 3, 5, 1, 1)

        self.programView = QGroupBox(Dialog)
        self.programView.setObjectName(u"programView")
        self.programView.setGeometry(QRect(10, 240, 501, 351))
        self.tableView = QTableView(self.programView)
        self.tableView.setObjectName(u"tableView")
        self.tableView.setGeometry(QRect(10, 20, 481, 321))
        self.saveProgram = QPushButton(Dialog)
        self.saveProgram.setObjectName(u"saveProgram")
        self.saveProgram.setGeometry(QRect(630, 282, 91, 24))
        self.clearAll = QPushButton(Dialog)
        self.clearAll.setObjectName(u"clearAll")
        self.clearAll.setGeometry(QRect(190, 592, 141, 24))
        self.loadProgram = QPushButton(Dialog)
        self.loadProgram.setObjectName(u"loadProgram")
        self.loadProgram.setGeometry(QRect(530, 282, 91, 24))

        self.retranslateUi(Dialog)

        QMetaObject.connectSlotsByName(Dialog)
    # setupUi

    def retranslateUi(self, Dialog):
        Dialog.setWindowTitle(QCoreApplication.translate("Dialog", u"Dialog", None))
        self.select_deselect.setText(QCoreApplication.translate("Dialog", u"Select/deselect all", None))
        self.groupBox.setTitle(QCoreApplication.translate("Dialog", u"Program", None))
        self.selectStepType.setItemText(0, QCoreApplication.translate("Dialog", u"ON", None))
        self.selectStepType.setItemText(1, QCoreApplication.translate("Dialog", u"OFF", None))
        self.selectStepType.setItemText(2, QCoreApplication.translate("Dialog", u"RAMP", None))
        self.selectStepType.setItemText(3, QCoreApplication.translate("Dialog", u"SINE", None))

        self.addStep.setText(QCoreApplication.translate("Dialog", u"Add Step", None))
        self.removeStep.setText(QCoreApplication.translate("Dialog", u"Remove Step", None))
#if QT_CONFIG(tooltip)
        self.int_2.setToolTip(QCoreApplication.translate("Dialog", u"Intensity of the LED, in uW/cm2", None))
#endif // QT_CONFIG(tooltip)
#if QT_CONFIG(tooltip)
        self.int0.setToolTip(QCoreApplication.translate("Dialog", u"For RAMP and SINE, initial intensity, uW/cm2", None))
#endif // QT_CONFIG(tooltip)
#if QT_CONFIG(tooltip)
        self.int1.setToolTip(QCoreApplication.translate("Dialog", u"For RAMP and SINE, final intensity, uW/cm2", None))
#endif // QT_CONFIG(tooltip)
#if QT_CONFIG(tooltip)
        self.duration_ms.setToolTip(QCoreApplication.translate("Dialog", u"Duration of the step in milliseconds", None))
#endif // QT_CONFIG(tooltip)
#if QT_CONFIG(tooltip)
        self.freq_Hz.setToolTip(QCoreApplication.translate("Dialog", u"For SINE, frequency of the wave", None))
#endif // QT_CONFIG(tooltip)
        self.label.setText(QCoreApplication.translate("Dialog", u"Intensity uW/cm2", None))
        self.label_2.setText(QCoreApplication.translate("Dialog", u"Initial intensity", None))
        self.label_3.setText(QCoreApplication.translate("Dialog", u"Final intensity", None))
        self.label_4.setText(QCoreApplication.translate("Dialog", u"Duration (ms)", None))
        self.label_5.setText(QCoreApplication.translate("Dialog", u"Frequency (Hz)", None))
        self.well01.setText(QCoreApplication.translate("Dialog", u"1", None))
        self.well02.setText(QCoreApplication.translate("Dialog", u"2", None))
        self.well03.setText(QCoreApplication.translate("Dialog", u"3", None))
        self.well04.setText(QCoreApplication.translate("Dialog", u"4", None))
        self.well05.setText(QCoreApplication.translate("Dialog", u"5", None))
        self.well06.setText(QCoreApplication.translate("Dialog", u"6", None))
        self.well07.setText(QCoreApplication.translate("Dialog", u"7", None))
        self.well08.setText(QCoreApplication.translate("Dialog", u"8", None))
        self.well09.setText(QCoreApplication.translate("Dialog", u"9", None))
        self.well10.setText(QCoreApplication.translate("Dialog", u"10", None))
        self.well11.setText(QCoreApplication.translate("Dialog", u"11", None))
        self.well12.setText(QCoreApplication.translate("Dialog", u"12", None))
        self.well13.setText(QCoreApplication.translate("Dialog", u"13", None))
        self.well14.setText(QCoreApplication.translate("Dialog", u"14", None))
        self.well15.setText(QCoreApplication.translate("Dialog", u"15", None))
        self.well16.setText(QCoreApplication.translate("Dialog", u"16", None))
        self.well17.setText(QCoreApplication.translate("Dialog", u"17", None))
        self.well18.setText(QCoreApplication.translate("Dialog", u"18", None))
        self.well19.setText(QCoreApplication.translate("Dialog", u"19", None))
        self.well20.setText(QCoreApplication.translate("Dialog", u"20", None))
        self.well21.setText(QCoreApplication.translate("Dialog", u"21", None))
        self.well22.setText(QCoreApplication.translate("Dialog", u"22", None))
        self.well23.setText(QCoreApplication.translate("Dialog", u"23", None))
        self.well24.setText(QCoreApplication.translate("Dialog", u"24", None))
        self.programView.setTitle(QCoreApplication.translate("Dialog", u"Steps", None))
#if QT_CONFIG(tooltip)
        self.saveProgram.setToolTip("")
#endif // QT_CONFIG(tooltip)
        self.saveProgram.setText(QCoreApplication.translate("Dialog", u"Save program", None))
        self.clearAll.setText(QCoreApplication.translate("Dialog", u"Clear program", None))
#if QT_CONFIG(tooltip)
        self.loadProgram.setToolTip("")
#endif // QT_CONFIG(tooltip)
        self.loadProgram.setText(QCoreApplication.translate("Dialog", u"Load program", None))
    # retranslateUi

